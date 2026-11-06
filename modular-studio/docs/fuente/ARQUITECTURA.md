# Arquitectura propuesta

```text
modular-studio/
  apps/web/
    src/app/{proyectos,catalogo,editor,proveedores,admin,api}/
    src/components/{catalog,editor,svg,parts,assembly,quote,quality}/
  packages/domain/src/{project,parts,materials,hardware,steel,pricing,validation}/
  packages/geometry/src/{models,projection,dimensioning,exploded}/
  packages/cut-optimizer/src/{rectpack,kerf,grain,offcuts}/
  packages/export/src/{json,csv,svg,pdf}/
  packages/db/prisma/schema.prisma
  data/seed/
  docs/
  tests/
```

## Fronteras de dominio
- **Domain**: modelos y reglas de fabricación, sin React ni red.
- **Geometry**: traduce módulo a sólidos/paneles, proyecta SVG; nunca altera el BOM.
- **Pricing**: consume BOM + precios con fecha y unidad, produce una cotización trazable.
- **Suppliers**: adaptadores manual CSV, API autorizada, captura de cotización; no depende del renderer.
- **Export**: renderiza datos congelados de revisión, con versión de cálculo.

## Entidades principales
User, Workspace, Customer, Project, ProjectRevision, FurnitureAssembly, Module, PanelPart, EdgeBand, MachiningOperation, HardwareRequirement, SteelRequirement, Supplier, Product, SupplierOffer, Quote, QuoteLine, Attachment, InspectionResult.

## Endpoints de referencia
`GET /api/templates`, `GET /api/materials`, `GET /api/suppliers`, `POST /api/projects`, `GET /api/projects/:id`, `PATCH /api/projects/:id`, `POST /api/projects/:id/revisions`, `POST /api/calculate`, `POST /api/quotes`, `POST /api/offers/import`, `POST /api/exports/:format`.

## Consideraciones
- API debe comprobar autorizaciones multiusuario/workspace; nunca confiar en costo enviado desde navegador.
- Precios exactos en enteros centavos MXN o Decimal, no float binario.
- En importación, validar datos y unidades, de-duplicar por proveedor+SKU+presentación+fecha.
- Mantener precio histórico, no sobrescribir la fuente.
- Generación PDF y render pueden ejecutarse del lado servidor; nunca almacenar secretos en cliente.
- Un mismo motor se ejecuta en backend y front para previsualización; backend valida versión antes de cotizar.
