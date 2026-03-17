"""
services/person_service.py — Lógica de negocio del módulo CRM

Gestiona personas (leads/clientes), interacciones y pipeline Kanban.
"""
import math
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from supabase import Client

from app.schemas.person_schemas import (
    AccountStatement,
    InteractionCreate,
    InteractionOut,
    KanbanBoard,
    KanbanCard,
    KanbanColumn,
    LEAD_STAGES,
    PaginatedPersons,
    PersonCreate,
    PersonFilters,
    PersonListItem,
    PersonOut,
    PersonUpdate,
    VehicleInterestCreate,
)
from app.utils.security import CurrentUser


class PersonService:
    """Servicio del módulo CRM: personas, interacciones y pipeline."""

    def __init__(self, db: Client):
        self.db = db

    # ──────────────────────────────────────────
    # Listar personas con filtros
    # ──────────────────────────────────────────
    async def list_persons(
        self,
        filters: PersonFilters,
        current_user: CurrentUser,
    ) -> PaginatedPersons:
        """
        Lista personas con filtros dinámicos.
        Los vendedores solo ven las personas que tienen asignadas.
        """
        query = self.db.table("persons").select(
            "id, person_type, first_name, last_name, email, phone, "
            "origin_channel, lead_status, next_contact_date, balance, created_at, "
            "assigned_seller_id, user_profiles!assigned_seller_id(full_name)",
            count="exact",
        ).is_("deleted_at", "null")

        # Vendedor solo ve sus personas asignadas
        if current_user.role == "vendedor":
            query = query.eq("assigned_seller_id", current_user.id)

        # Aplicar filtros
        if filters.person_type:
            query = query.eq("person_type", filters.person_type)
        if filters.lead_status:
            query = query.eq("lead_status", filters.lead_status)
        if filters.origin_channel:
            query = query.eq("origin_channel", filters.origin_channel)
        if filters.assigned_seller_id and current_user.role == "admin":
            query = query.eq("assigned_seller_id", str(filters.assigned_seller_id))
        if filters.has_pending_contact:
            query = query.lte("next_contact_date", date.today().isoformat())
        if filters.search:
            t = filters.search
            query = query.or_(
                f"first_name.ilike.%{t}%,"
                f"last_name.ilike.%{t}%,"
                f"email.ilike.%{t}%,"
                f"phone.ilike.%{t}%,"
                f"dni_cuit.ilike.%{t}%"
            )

        offset = (filters.page - 1) * filters.per_page
        query = query.order("created_at", desc=True).range(
            offset, offset + filters.per_page - 1
        )

        response = query.execute()
        total = response.count or 0
        items = []
        for row in response.data or []:
            seller_name = None
            if row.get("user_profiles"):
                seller_name = row["user_profiles"].get("full_name")
            items.append(PersonListItem(
                id=row["id"],
                person_type=row["person_type"],
                first_name=row["first_name"],
                last_name=row["last_name"],
                email=row.get("email"),
                phone=row.get("phone"),
                origin_channel=row.get("origin_channel"),
                lead_status=row["lead_status"],
                next_contact_date=row.get("next_contact_date"),
                assigned_seller_name=seller_name,
                balance=Decimal(str(row.get("balance", 0))),
                created_at=row.get("created_at"),
            ))

        return PaginatedPersons(
            items=items,
            total=total,
            page=filters.page,
            per_page=filters.per_page,
            pages=math.ceil(total / filters.per_page) if total > 0 else 0,
        )

    # ──────────────────────────────────────────
    # Obtener persona por ID
    # ──────────────────────────────────────────
    async def get_person(
        self,
        person_id: UUID,
        current_user: CurrentUser,
    ) -> dict:
        """Retorna el detalle completo de una persona."""
        response = self.db.table("persons").select(
            "*, user_profiles!assigned_seller_id(full_name)"
        ).eq("id", str(person_id)).is_("deleted_at", "null").single().execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Persona no encontrada",
            )

        person = response.data

        # Vendedor: solo puede ver sus personas
        if (
            current_user.role == "vendedor"
            and person.get("assigned_seller_id") != current_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tenés acceso a esta persona",
            )

        # Enriquecer con nombre del vendedor
        person["assigned_seller_name"] = None
        if person.get("user_profiles"):
            person["assigned_seller_name"] = person["user_profiles"].get("full_name")
        person.pop("user_profiles", None)
        person["full_name"] = f"{person['first_name']} {person['last_name']}"

        return person

    # ──────────────────────────────────────────
    # Crear persona
    # ──────────────────────────────────────────
    async def create_person(
        self,
        data: PersonCreate,
        current_user: CurrentUser,
    ) -> dict:
        """Crea un nuevo lead o cliente."""
        person_data = data.model_dump(exclude_none=True)

        # Vendedor solo puede crear personas asignadas a sí mismo
        if current_user.role == "vendedor":
            person_data["assigned_seller_id"] = current_user.id

        # Convertir UUIDs a string
        if "assigned_seller_id" in person_data:
            person_data["assigned_seller_id"] = str(person_data["assigned_seller_id"])
        if "birth_date" in person_data and person_data["birth_date"]:
            person_data["birth_date"] = person_data["birth_date"].isoformat()

        response = self.db.table("persons").insert(person_data).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al crear la persona",
            )
        return response.data[0]

    # ──────────────────────────────────────────
    # Actualizar persona
    # ──────────────────────────────────────────
    async def update_person(
        self,
        person_id: UUID,
        data: PersonUpdate,
        current_user: CurrentUser,
    ) -> dict:
        """Actualiza los datos de una persona."""
        await self.get_person(person_id, current_user)   # Verifica acceso

        update_data = data.model_dump(exclude_none=True)

        # Vendedor no puede reasignar personas
        if current_user.role == "vendedor":
            update_data.pop("assigned_seller_id", None)

        if not update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No hay datos para actualizar",
            )

        # Convertir tipos
        if "assigned_seller_id" in update_data:
            update_data["assigned_seller_id"] = str(update_data["assigned_seller_id"])
        if "birth_date" in update_data and update_data["birth_date"]:
            update_data["birth_date"] = update_data["birth_date"].isoformat()
        if "next_contact_date" in update_data and update_data["next_contact_date"]:
            update_data["next_contact_date"] = update_data["next_contact_date"].isoformat()

        response = self.db.table("persons").update(update_data).eq(
            "id", str(person_id)
        ).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al actualizar la persona",
            )
        return response.data[0]

    # ──────────────────────────────────────────
    # Soft delete
    # ──────────────────────────────────────────
    async def delete_person(self, person_id: UUID) -> dict:
        """Soft delete de persona. Solo admin."""
        response = self.db.table("persons").update({
            "deleted_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", str(person_id)).execute()
        return {"message": "Persona eliminada correctamente"}

    # ──────────────────────────────────────────
    # Pipeline Kanban
    # ──────────────────────────────────────────
    async def get_kanban(
        self,
        current_user: CurrentUser,
        seller_id: Optional[UUID] = None,
    ) -> KanbanBoard:
        """
        Retorna el pipeline de leads agrupado por etapa para el Kanban.
        Admin puede ver todos o filtrar por vendedor.
        Vendedor solo ve sus leads.
        """
        STAGE_LABELS = {
            "nuevo": "Nuevo",
            "contactado": "Contactado",
            "interesado": "Interesado",
            "en_negociacion": "En Negociación",
            "cerrado_ganado": "Ganado ✓",
            "cerrado_perdido": "Perdido ✗",
        }

        query = self.db.table("persons").select(
            "id, first_name, last_name, phone, whatsapp, origin_channel, "
            "next_contact_date, lead_status, created_at, assigned_seller_id, "
            "user_profiles!assigned_seller_id(full_name)"
        ).is_("deleted_at", "null").in_("lead_status", LEAD_STAGES)

        # Filtrar por vendedor
        if current_user.role == "vendedor":
            query = query.eq("assigned_seller_id", current_user.id)
        elif seller_id:
            query = query.eq("assigned_seller_id", str(seller_id))

        response = query.order("created_at", desc=True).execute()
        all_leads = response.data or []

        # Obtener última interacción y vehículos de interés para cada lead
        lead_ids = [row["id"] for row in all_leads]

        interactions_by_person: dict[str, dict] = {}
        interests_by_person: dict[str, list[str]] = {}

        if lead_ids:
            # Última interacción por persona
            inter_resp = self.db.table("interactions").select(
                "person_id, interaction_type, date"
            ).in_("person_id", lead_ids).order("date", desc=True).execute()

            for inter in inter_resp.data or []:
                pid = inter["person_id"]
                if pid not in interactions_by_person:
                    interactions_by_person[pid] = inter

            # Intereses en vehículos
            interest_resp = self.db.table("person_vehicle_interests").select(
                "person_id, description, vehicles(brand, model, year)"
            ).in_("person_id", lead_ids).execute()

            for interest in interest_resp.data or []:
                pid = interest["person_id"]
                if pid not in interests_by_person:
                    interests_by_person[pid] = []
                v = interest.get("vehicles")
                if v:
                    interests_by_person[pid].append(
                        f"{v.get('brand', '')} {v.get('model', '')} {v.get('year', '')}"
                    )
                elif interest.get("description"):
                    interests_by_person[pid].append(interest["description"])

        # Agrupar por etapa
        today = date.today()
        grouped: dict[str, list[KanbanCard]] = {stage: [] for stage in LEAD_STAGES}

        for row in all_leads:
            pid = row["id"]
            last_inter = interactions_by_person.get(pid)
            last_date = None
            days_without = None
            if last_inter:
                last_date_str = last_inter.get("date")
                if last_date_str:
                    last_date = datetime.fromisoformat(last_date_str.replace("Z", "+00:00"))
                    days_without = (today - last_date.date()).days

            seller_name = None
            if row.get("user_profiles"):
                seller_name = row["user_profiles"].get("full_name")

            card = KanbanCard(
                id=row["id"],
                first_name=row["first_name"],
                last_name=row["last_name"],
                phone=row.get("phone"),
                whatsapp=row.get("whatsapp"),
                origin_channel=row.get("origin_channel"),
                next_contact_date=row.get("next_contact_date"),
                assigned_seller_name=seller_name,
                vehicle_interests=interests_by_person.get(pid, []),
                last_interaction_date=last_date,
                last_interaction_type=last_inter.get("interaction_type") if last_inter else None,
                days_without_contact=days_without,
                created_at=row.get("created_at"),
            )

            stage = row.get("lead_status", "nuevo")
            if stage in grouped:
                grouped[stage].append(card)

        columns = [
            KanbanColumn(
                stage=stage,
                label=STAGE_LABELS[stage],
                count=len(cards),
                cards=cards,
            )
            for stage, cards in grouped.items()
        ]

        return KanbanBoard(
            columns=columns,
            total_leads=len(all_leads),
        )

    # ──────────────────────────────────────────
    # Interacciones
    # ──────────────────────────────────────────
    async def list_interactions(
        self,
        person_id: UUID,
        current_user: CurrentUser,
    ) -> list[dict]:
        """Lista todas las interacciones de una persona, de más reciente a más antigua."""
        await self.get_person(person_id, current_user)   # Verifica acceso

        response = self.db.table("interactions").select(
            "*, user_profiles!created_by(full_name)"
        ).eq("person_id", str(person_id)).order("date", desc=True).execute()

        result = []
        for row in response.data or []:
            row["created_by_name"] = None
            if row.get("user_profiles"):
                row["created_by_name"] = row["user_profiles"].get("full_name")
            row.pop("user_profiles", None)
            result.append(row)
        return result

    async def create_interaction(
        self,
        person_id: UUID,
        data: InteractionCreate,
        current_user: CurrentUser,
    ) -> dict:
        """
        Registra una nueva interacción con un lead/cliente.
        Actualiza automáticamente next_contact_date en la persona.
        """
        await self.get_person(person_id, current_user)   # Verifica acceso

        inter_data = data.model_dump(exclude_none=True)
        inter_data["person_id"] = str(person_id)
        inter_data["created_by"] = current_user.id

        if "date" in inter_data and isinstance(inter_data["date"], datetime):
            inter_data["date"] = inter_data["date"].isoformat()

        # Fechas a ISO string
        if "next_contact_date" in inter_data and inter_data["next_contact_date"]:
            next_date = inter_data["next_contact_date"]
            inter_data["next_contact_date"] = (
                next_date.isoformat() if isinstance(next_date, date) else next_date
            )

        response = self.db.table("interactions").insert(inter_data).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al registrar la interacción",
            )

        # Actualizar next_contact_date en la persona si se especificó
        if data.next_contact_date:
            self.db.table("persons").update({
                "next_contact_date": data.next_contact_date.isoformat(),
                "next_contact_action": data.next_contact_action,
            }).eq("id", str(person_id)).execute()

        # Avanzar automáticamente el estado del lead si estaba en 'nuevo'
        person_resp = self.db.table("persons").select("lead_status").eq(
            "id", str(person_id)
        ).single().execute()
        if person_resp.data and person_resp.data.get("lead_status") == "nuevo":
            self.db.table("persons").update(
                {"lead_status": "contactado"}
            ).eq("id", str(person_id)).execute()

        return response.data[0]

    # ──────────────────────────────────────────
    # Vehículos de interés
    # ──────────────────────────────────────────
    async def add_vehicle_interest(
        self,
        person_id: UUID,
        data: VehicleInterestCreate,
        current_user: CurrentUser,
    ) -> dict:
        await self.get_person(person_id, current_user)

        interest_data: dict = {"person_id": str(person_id)}
        if data.vehicle_id:
            interest_data["vehicle_id"] = str(data.vehicle_id)
        if data.description:
            interest_data["description"] = data.description

        response = self.db.table("person_vehicle_interests").insert(interest_data).execute()
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al registrar el interés",
            )
        return response.data[0]

    async def list_vehicle_interests(
        self,
        person_id: UUID,
        current_user: CurrentUser,
    ) -> list[dict]:
        await self.get_person(person_id, current_user)

        response = self.db.table("person_vehicle_interests").select(
            "*, vehicles(brand, model, year, version, list_price)"
        ).eq("person_id", str(person_id)).order("created_at", desc=True).execute()

        result = []
        for row in response.data or []:
            v = row.pop("vehicles", None)
            if v:
                row["vehicle_info"] = f"{v.get('brand', '')} {v.get('model', '')} {v.get('version', '')} {v.get('year', '')}".strip()
                row["vehicle_list_price"] = v.get("list_price")
            else:
                row["vehicle_info"] = None
                row["vehicle_list_price"] = None
            result.append(row)
        return result

    # ──────────────────────────────────────────
    # Ventas del cliente
    # ──────────────────────────────────────────
    async def get_person_sales(
        self,
        person_id: UUID,
        current_user: CurrentUser,
    ) -> list[dict]:
        """Lista el historial de compras de un cliente."""
        await self.get_person(person_id, current_user)

        response = self.db.table("sales").select(
            "id, sale_number, sale_date, status, final_price, "
            "vehicles(brand, model, year, version)"
        ).eq("client_id", str(person_id)).is_("deleted_at", "null").order(
            "sale_date", desc=True
        ).execute()

        result = []
        for row in response.data or []:
            v = row.pop("vehicles", None)
            if v:
                row["vehicle_info"] = f"{v.get('brand', '')} {v.get('model', '')} {v.get('version', '')} {v.get('year', '')}".strip()
            else:
                row["vehicle_info"] = None
            result.append(row)
        return result

    # ──────────────────────────────────────────
    # Cuenta corriente
    # ──────────────────────────────────────────
    async def get_account_statement(
        self,
        person_id: UUID,
        current_user: CurrentUser,
    ) -> AccountStatement:
        """Retorna el estado de la cuenta corriente de un cliente."""
        person = await self.get_person(person_id, current_user)

        # Movimientos de caja relacionados a esta persona
        movements_resp = self.db.table("cash_movements").select(
            "movement_date, description, amount, movement_type, category"
        ).eq("person_id", str(person_id)).order("movement_date", desc=True).execute()

        from app.schemas.person_schemas import AccountMovement
        movements = [
            AccountMovement(
                date=m["movement_date"],
                description=m["description"],
                amount=Decimal(str(m["amount"])),
                movement_type=m["movement_type"],
                reference_type=m.get("category", "manual"),
            )
            for m in movements_resp.data or []
        ]

        return AccountStatement(
            person_id=person_id,
            full_name=f"{person['first_name']} {person['last_name']}",
            balance=Decimal(str(person.get("balance", 0))),
            movements=movements,
        )
