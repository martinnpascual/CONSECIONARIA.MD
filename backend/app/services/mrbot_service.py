"""
services/mrbot_service.py — Cliente de MrBot API para facturación ARCA (ex AFIP)

MrBot actúa como proxy hacia los WebServices de AFIP/ARCA, simplificando:
- La gestión del token WSAA (autenticación)
- La emisión de comprobantes (FECAESolicitar)
- La consulta de CAE obtenidos

Documentación: https://docs.mrbot.com.ar/arca
"""
import json
import os
from typing import Any, Optional

import httpx
from fastapi import HTTPException, status
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config import get_settings

settings = get_settings()


class MrBotInvoiceRequest:
    """Construcción del payload de factura para MrBot API."""

    def __init__(
        self,
        invoice_type: str,          # "A", "B", "C"
        punto_venta: int,
        emisor_cuit: str,
        receptor_cuit: Optional[str],
        receptor_name: str,
        receptor_iva_cond: str,      # "Responsable Inscripto", "Consumidor Final", etc.
        net_amount: float,
        iva_amount: float,
        total_amount: float,
        description: str,
        invoice_date: Optional[str] = None,  # "YYYY-MM-DD", por defecto hoy
    ):
        self.invoice_type = invoice_type
        self.punto_venta = punto_venta
        self.emisor_cuit = emisor_cuit
        self.receptor_cuit = receptor_cuit
        self.receptor_name = receptor_name
        self.receptor_iva_cond = receptor_iva_cond
        self.net_amount = net_amount
        self.iva_amount = iva_amount
        self.total_amount = total_amount
        self.description = description
        self.invoice_date = invoice_date

    def to_payload(self) -> dict:
        """Construye el dict para la API de MrBot."""
        # Mapeo de tipo a código de comprobante AFIP
        tipo_cbte_map = {
            "A": 1, "B": 6, "C": 11,
            "ND_A": 2, "ND_B": 7,
            "NC_A": 3, "NC_B": 8,
        }
        # Condición IVA del receptor
        iva_cond_map = {
            "Responsable Inscripto": 1,
            "Consumidor Final": 5,
            "Monotributo": 6,
            "Exento": 4,
            "No Categorizado": 3,
        }

        payload = {
            "CantReg": 1,
            "PtoVta": self.punto_venta,
            "CbteTipo": tipo_cbte_map.get(self.invoice_type, 6),
            "Concepto": 1,  # 1 = Productos
            "DocTipo": 80 if self.receptor_cuit else 99,  # 80=CUIT, 99=Sin documento
            "DocNro": int(self.receptor_cuit.replace("-", "")) if self.receptor_cuit else 0,
            "ImpTotal": round(self.total_amount, 2),
            "ImpNeto": round(self.net_amount, 2),
            "ImpIVA": round(self.iva_amount, 2),
            "ImpTrib": 0,
            "ImpOpEx": 0,
            "FchServDesde": None,
            "FchServHasta": None,
            "FchVtoPago": None,
            "MonId": "PES",
            "MonCotiz": 1,
            "Iva": [
                {
                    "Id": 5,  # 21% = ID 5
                    "BaseImp": round(self.net_amount, 2),
                    "Importe": round(self.iva_amount, 2),
                }
            ] if self.iva_amount > 0 else [],
            # Datos receptor
            "Receptor": {
                "DocTipo": 80 if self.receptor_cuit else 99,
                "DocNro": int(self.receptor_cuit.replace("-", "")) if self.receptor_cuit else 0,
                "RazonSocial": self.receptor_name,
                "CondIvaId": iva_cond_map.get(self.receptor_iva_cond, 5),
                "Domicilio": "",
            },
            # Adicional
            "Observaciones": self.description,
        }

        if self.invoice_date:
            payload["CbteDesde"] = payload["CbteHasta"] = self.invoice_date.replace("-", "")

        return payload


class MrBotService:
    """
    Cliente HTTP para la API de MrBot.
    Cada método llama a un endpoint de MrBot que internamente interactúa con ARCA/AFIP.
    """

    def __init__(self):
        self.base_url = "https://api.mrbot.com.ar/v1"
        self.email = settings.mrbot_email
        self.api_key = settings.mrbot_api_key
        self.cuit = settings.afip_cuit
        self.punto_venta = settings.afip_punto_venta
        self.testing = settings.afip_testing

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-CUIT": self.cuit,
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
    )
    async def emit_invoice(self, request: MrBotInvoiceRequest) -> dict:
        """
        Emite un comprobante electrónico via MrBot → ARCA.
        Retorna el response completo incluyendo CAE, CAEFchVto, CbteNro.
        En modo testing usa el endpoint de sandbox de ARCA.
        """
        if self.testing:
            endpoint = f"{self.base_url}/testing/fecae-solicitar"
        else:
            endpoint = f"{self.base_url}/fecae-solicitar"

        payload = request.to_payload()

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                endpoint,
                headers=self._headers(),
                json=payload,
            )

        if response.status_code == 200:
            data = response.json()
            # Verificar si ARCA aprobó el comprobante
            if data.get("Resultado") == "A":  # A = Aprobado
                return data
            else:
                # ARCA rechazó
                obs = data.get("Observaciones", [])
                errores = data.get("Errores", [])
                error_msg = "; ".join(
                    [f"{o.get('Code')}: {o.get('Msg')}" for o in obs + errores]
                )
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"ARCA rechazó el comprobante: {error_msg}",
                )
        elif response.status_code == 401:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Error de autenticación con MrBot API. Verificar credenciales.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Error en MrBot API: {response.status_code} — {response.text[:200]}",
            )

    async def get_last_invoice_number(self, invoice_type: str) -> int:
        """Consulta el último número de comprobante emitido para un tipo."""
        tipo_cbte_map = {"A": 1, "B": 6, "C": 11}
        tipo = tipo_cbte_map.get(invoice_type, 6)

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{self.base_url}/ultimo-comprobante",
                headers=self._headers(),
                params={"PtoVta": self.punto_venta, "CbteTipo": tipo},
            )

        if response.status_code == 200:
            return response.json().get("CbteNro", 0)
        return 0

    def parse_cae_response(self, mrbot_response: dict) -> dict:
        """
        Extrae CAE, número de comprobante y fecha de vencimiento del response de MrBot.
        Retorna un dict limpio para guardar en la DB.
        """
        det = mrbot_response.get("FeDetResp", {}).get("FECAEDetResponse", [{}])
        if isinstance(det, list) and det:
            det = det[0]

        return {
            "cae": det.get("CAE"),
            "cae_expiry_date": self._parse_afip_date(det.get("CAEFchVto")),
            "invoice_number": str(det.get("CbteNro", "")),
        }

    def _parse_afip_date(self, afip_date: Optional[str]) -> Optional[str]:
        """Convierte fecha AFIP (YYYYMMDD) a formato ISO (YYYY-MM-DD)."""
        if not afip_date or len(afip_date) != 8:
            return None
        return f"{afip_date[:4]}-{afip_date[4:6]}-{afip_date[6:8]}"
