-- ============================================================
-- 001_seed_data.sql — Datos de prueba para DM Cars
-- DM Cars — Sesión S-01
-- IMPORTANTE: Ejecutar DESPUÉS de todas las migraciones
-- SOLO para entornos de desarrollo/testing
-- ============================================================

-- ──────────────────────────────────────────────
-- Datos de la concesionaria
-- ──────────────────────────────────────────────
INSERT INTO public.businesses (
    name, legal_name, cuit, iva_condition,
    address, city, province, postal_code,
    phone, email, website,
    afip_punto_venta, stock_alert_days,
    commission_pct, reservation_days,
    usd_rate, usd_rate_updated_at
) VALUES (
    'DM Cars',
    'Dante Mostajo S.R.L.',
    '30-71234567-0',
    'responsable_inscripto',
    'Av. Libertador 1234',
    'Buenos Aires',
    'CABA',
    '1001',
    '+54 11 4567-8900',
    'info@dmcars.com.ar',
    'www.dmcars.com.ar',
    1,
    90,
    2.50,
    7,
    1250.00,
    NOW()
) ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────
-- Personas de prueba (leads y clientes)
-- Nota: Los usuarios se crean vía Supabase Auth.
-- Estas personas son clientes/leads del sistema.
-- ──────────────────────────────────────────────
INSERT INTO public.persons (
    id, person_type, first_name, last_name,
    dni_cuit, iva_condition, email, phone, whatsapp,
    address, city, province,
    origin_channel, lead_status, notes
) VALUES
    (
        'a1b2c3d4-0001-0001-0001-000000000001',
        'lead', 'Martín', 'García',
        '32.456.789', 'consumidor_final',
        'martin.garcia@email.com', '+54 11 1234-5678', '+54 9 11 1234-5678',
        'Av. Corrientes 456', 'Buenos Aires', 'CABA',
        'instagram', 'interesado',
        'Interesado en SUV familiar. Presupuesto hasta USD 35.000'
    ),
    (
        'a1b2c3d4-0002-0002-0002-000000000002',
        'lead', 'Laura', 'Fernández',
        '28.789.123', 'consumidor_final',
        'laura.fernandez@email.com', '+54 11 2345-6789', '+54 9 11 2345-6789',
        'Av. Santa Fe 789', 'Buenos Aires', 'CABA',
        'mercadolibre', 'nuevo',
        'Consultó por Toyota Hilux 0km'
    ),
    (
        'a1b2c3d4-0003-0003-0003-000000000003',
        'cliente', 'Roberto', 'López',
        '25.321.654', 'responsable_inscripto',
        'roberto.lopez@empresa.com', '+54 11 3456-7890', '+54 9 11 3456-7890',
        'Av. Belgrano 1234', 'Buenos Aires', 'CABA',
        'showroom', 'cerrado_ganado',
        'Compró una Toyota Hilux en S-01. Cliente VIP.'
    ),
    (
        'a1b2c3d4-0004-0004-0004-000000000004',
        'lead', 'Carolina', 'Martínez',
        '35.654.321', 'consumidor_final',
        'carolina.martinez@email.com', '+54 11 4567-8901', NULL,
        'Thames 567', 'Buenos Aires', 'CABA',
        'web', 'contactado',
        'Busca auto usado por debajo de ARS 15.000.000'
    ),
    (
        'a1b2c3d4-0005-0005-0005-000000000005',
        'consignante', 'Diego', 'Ramírez',
        '30-65432100-5', 'monotributo',
        'diego.ramirez@email.com', '+54 11 5678-9012', '+54 9 11 5678-9012',
        'Palermo Soho 890', 'Buenos Aires', 'CABA',
        'referido', 'nuevo',
        'Propietario de vehículo en consignación'
    )
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────
-- Vehículos de prueba
-- ──────────────────────────────────────────────
INSERT INTO public.vehicles (
    id, vehicle_type, status,
    brand, model, version, year, model_year,
    color, fuel_type, transmission, doors, body_type,
    chassis_number, plate,
    mileage,
    list_price, cost_price, min_price, currency,
    location, description,
    equipment, entry_date
) VALUES
    -- Vehículos NUEVOS
    (
        'a0000000-0000-0000-0000-000000000001',
        'nuevo', 'disponible',
        'Toyota', 'Corolla', 'XEI CVT 2.0', 2026, 2026,
        'Blanco Perla', 'nafta', 'cvt', 4, 'sedan',
        'ABC123456789XY001', NULL,
        NULL,
        28500000, 24200000, 26000000, 'ARS',
        'Salón',
        'Toyota Corolla XEI 2026 0km. Equipado con pantalla táctil, cámara de retroceso y control de crucero adaptativo.',
        '["Pantalla táctil 9\"", "Cámara de retroceso", "Control crucero adaptativo", "Bluetooth", "Apple CarPlay/Android Auto", "Sensores de estacionamiento", "Faros LED"]',
        '2026-03-10'
    ),
    (
        'a0000000-0000-0000-0000-000000000002',
        'nuevo', 'disponible',
        'Toyota', 'Hilux', 'SRX 4x4 AT', 2026, 2026,
        'Gris Oscuro', 'diesel', 'automatica', 4, 'pickup',
        'DEF987654321XY002', NULL,
        NULL,
        65000000, 56000000, 60000000, 'ARS',
        'Salón',
        'Toyota Hilux SRX 4x4 2026 0km. La pickup más vendida de Argentina, lista para trabajo y aventura.',
        '["Cuero", "Pantalla táctil 8\"", "4x4 con diferencial", "Control de descenso", "Bluetooth", "Apple CarPlay", "Cámara de retroceso", "Neblineros LED"]',
        '2026-03-01'
    ),
    (
        'a0000000-0000-0000-0000-000000000003',
        'nuevo', 'disponible',
        'Volkswagen', 'Taos', 'Comfortline AT', 2026, 2026,
        'Rojo Tornado', 'nafta', 'automatica', 5, 'suv',
        'GHI111222333XY003', NULL,
        NULL,
        34000000, 29500000, 31000000, 'ARS',
        'Salón',
        'VW Taos Comfortline 2026 0km. SUV familiar con el espacio y tecnología que necesitás.',
        '["Pantalla 10\" Discover Pro", "Apple CarPlay inalámbrico", "Asientos calefaccionados", "Sensor de lluvia", "Park Assist", "Climatizador bizona"]',
        '2026-03-05'
    ),
    -- Vehículos USADOS
    (
        'a0000000-0000-0000-0000-000000000004',
        'usado', 'disponible',
        'Ford', 'Ranger', 'XLT 4x4 MT 2.2', 2022, 2022,
        'Blanco Oxford', 'diesel', 'manual', 4, 'pickup',
        'JKL444555666XY004', 'AB 123 CD',
        48500,
        38000000, 32000000, 35000000, 'ARS',
        'Depósito',
        'Ford Ranger XLT 2022 usada. Un dueño, service oficial completo. Impecable estado.',
        '["Radio con Bluetooth", "Cámara de retroceso", "Sensores de estacionamiento", "4x4", "Control de crucero", "Climatizador"]',
        '2026-02-20'
    ),
    (
        'a0000000-0000-0000-0000-000000000005',
        'usado', 'disponible',
        'Chevrolet', 'Onix', 'LTZ AT', 2023, 2023,
        'Negro Onice', 'nafta', 'automatica', 4, 'sedan',
        'MNO777888999XY005', 'EF 456 GH',
        22000,
        18500000, 16000000, 17000000, 'ARS',
        'Salón',
        'Chevrolet Onix LTZ AT 2023. Casi 0km, impecable. Ideal para ciudad.',
        '["Pantalla táctil MyLink", "Apple CarPlay", "Control de crucero", "Sensor de estacionamiento posterior", "Cámara de retroceso"]',
        '2026-03-08'
    ),
    (
        'a0000000-0000-0000-0000-000000000006',
        'usado', 'reservado',
        'Honda', 'HR-V', 'EXL CVT', 2021, 2021,
        'Azul Brillante', 'nafta', 'cvt', 5, 'suv',
        'PQR000111222XY006', 'IJ 789 KL',
        41000,
        25000000, 21000000, 23000000, 'ARS',
        'Salón',
        'Honda HR-V EXL 2021 usada. Motor 1.8 nafta, CVT. Excelente estado, un solo dueño.',
        '["Techo solar panorámico", "Cuero", "GPS integrado", "Bluetooth", "Cámara 360°", "Honda Sensing", "Control de crucero adaptativo"]',
        '2026-02-15'
    ),
    -- Vehículo en CONSIGNACIÓN
    (
        'a0000000-0000-0000-0000-000000000007',
        'consignacion', 'disponible',
        'Mercedes-Benz', 'GLA', '200 AMG Line', 2023, 2023,
        'Gris Montaña', 'nafta', 'automatica', 5, 'suv',
        'STU333444555XY007', 'MN 012 OP',
        18500,
        48000000, NULL, NULL, 'ARS',
        'Salón',
        'Mercedes-Benz GLA 200 AMG Line 2023. Impecable, todos los extras de fábrica.',
        '["Pantalla MBUX 10.25\"", "Asientos de cuero", "Techo panorámico", "Faros LED", "Paquete AMG exterior", "Sonido Burmester", "Carplay inalámbrico"]',
        '2026-03-12'
    )
ON CONFLICT (id) DO NOTHING;

-- ──────────────────────────────────────────────
-- Interacciones de prueba (CRM)
-- ──────────────────────────────────────────────
INSERT INTO public.interactions (
    person_id, interaction_type, date, result, notes, next_contact_date, next_contact_action
) VALUES
    (
        'a1b2c3d4-0001-0001-0001-000000000001',
        'whatsapp',
        NOW() - INTERVAL '5 days',
        'Respondió con interés. Quiere ver la Taos y también la Corolla.',
        'Viene el sábado a las 11hs',
        CURRENT_DATE + INTERVAL '3 days',
        'Confirmar visita y preparar cotización de Taos y Corolla'
    ),
    (
        'a1b2c3d4-0001-0001-0001-000000000001',
        'llamada',
        NOW() - INTERVAL '2 days',
        'Confirmó visita para el sábado. Muy interesado en la Taos.',
        'Tiene aprobación de crédito del Banco Nación',
        CURRENT_DATE + INTERVAL '1 day',
        'Preparar cotización con financiamiento del Banco Nación para la Taos'
    ),
    (
        'a1b2c3d4-0002-0002-0002-000000000002',
        'email',
        NOW() - INTERVAL '1 day',
        'Enviamos información y ficha técnica de la Hilux SRX.',
        'No respondió aún',
        CURRENT_DATE + INTERVAL '2 days',
        'Hacer seguimiento por WhatsApp si no responde el email'
    )
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────
-- Consignación de prueba
-- ──────────────────────────────────────────────
INSERT INTO public.consignments (
    id, vehicle_id, owner_id, status,
    start_date, end_date,
    owner_floor_price,
    commission_type, commission_value,
    notes
) VALUES (
    'c0000001-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000007',
    'a1b2c3d4-0005-0005-0005-000000000005',
    'activa',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '90 days',
    45000000,
    'porcentaje', 5.00,
    'Propietario acepta precio mínimo de $45M. Comisión 5% sobre el precio de venta.'
) ON CONFLICT (id) DO NOTHING;

-- Actualizar FK de consignación en el vehículo
UPDATE public.vehicles
SET consignment_id = 'c0000001-0000-0000-0000-000000000001'
WHERE id = 'a0000000-0000-0000-0000-000000000007';

-- ──────────────────────────────────────────────
-- Intereses de leads en vehículos
-- ──────────────────────────────────────────────
INSERT INTO public.person_vehicle_interests (person_id, vehicle_id, description)
VALUES
    ('a1b2c3d4-0001-0001-0001-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Interesado en la Taos Comfortline'),
    ('a1b2c3d4-0001-0001-0001-000000000001', 'a0000000-0000-0000-0000-000000000001', 'También considera el Corolla'),
    ('a1b2c3d4-0002-0002-0002-000000000002', 'a0000000-0000-0000-0000-000000000002', 'Quiere la Hilux SRX 4x4')
ON CONFLICT DO NOTHING;
