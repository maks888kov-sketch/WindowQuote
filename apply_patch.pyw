#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parent

REPLACEMENTS = {
    "apps/web/src/context/OrgContext.tsx": [
        (
            """type OrgMembership = {\n  org_id: string;\n  role: string;\n  orgs?: { name: string } | null;\n};""",
            """type OrgMembership = {\n  org_id: string;\n  role: string;\n  orgs?: { name: string }[] | null;\n};""",
        ),
        (
            "if (error.status === 401 || error.status === 403)",
            "if ((error as any)?.code === \"PGRST301\")",
        ),
    ],
    "apps/web/src/pages/NewMeasurementPage.tsx": [
        (
            """type ItemAttachment = {\n  measurement_item_id: string;\n  attachments: {\n    id: string;\n    path: string;\n    mime: string | null;\n    size: number | null;\n  } | null;\n};""",
            """type ItemAttachment = {\n  measurement_item_id: string;\n  attachments: {\n    id: string;\n    path: string;\n    mime: string | null;\n    size: number | null;\n  }[];\n};""",
        ),
        (
            "list.push(attachment as ItemAttachment);",
            "list.push(attachment as unknown as ItemAttachment);",
        ),
        (
            'const [paramsJson, setParamsJson] = useState("{}" as const);',
            'const [paramsJson, setParamsJson] = useState<string>("{}");',
        ),
        (
            '<li key={attachment.attachments?.id ?? attachment.measurement_item_id}>',
            '<li key={attachment.attachments?.[0]?.id ?? attachment.measurement_item_id}>',
        ),
        (
            '{attachment.attachments?.path.split("/").pop()} ({attachment.attachments?.size ?? 0} bytes)',
            '{attachment.attachments?.[0]?.path.split("/").pop()} ({attachment.attachments?.[0]?.size ?? 0} bytes)',
        ),
    ],
    "apps/web/src/pages/OrdersPage.tsx": [
        (
            "customers?: { name: string } | null;",
            "customers?: { name: string }[] | null;",
        ),
        (
            "sites?: { name: string } | null;",
            "sites?: { name: string }[] | null;",
        ),
        (
            '{order.status} · {order.sites?.name ?? "No site"}',
            '{order.status} · {order.sites?.[0]?.name ?? "No site"}',
        ),
    ],
    "apps/web/src/pages/OrderDetailPage.tsx": [
        (
            "customers?: { name: string } | null;",
            "customers?: { name: string }[] | null;",
        ),
        (
            "sites?: { name: string } | null;",
            "sites?: { name: string }[] | null;",
        ),
        (
            '<p>Customer: {order?.customers?.name ?? "Unknown"}</p>',
            '<p>Customer: {order?.customers?.[0]?.name ?? "Unknown"}</p>',
        ),
        (
            '<p>Site: {order?.sites?.name ?? "No site"}</p>',
            '<p>Site: {order?.sites?.[0]?.name ?? "No site"}</p>',
        ),
    ],
    "apps/web/src/components/Layout.tsx": [
        (
            "const activeOrgName = orgs.find((org) => org.org_id === activeOrgId)?.orgs?.name;",
            "const activeOrgName = orgs.find((org) => org.org_id === activeOrgId)?.orgs?.[0]?.name;",
        )
    ],
    "apps/web/src/pages/OrgSelectPage.tsx": [
        (
            "{org.orgs?.name ?? org.org_id}",
            "{org.orgs?.[0]?.name ?? org.org_id}",
        )
    ],
}


def apply_replacements(file_path: Path, replacements: list[tuple[str, str]]) -> None:
    text = file_path.read_text(encoding="utf-8")
    updated = text
    for old, new in replacements:
        if old in updated:
            updated = updated.replace(old, new)
    if updated != text:
        file_path.write_text(updated, encoding="utf-8")


for rel_path, replacements in REPLACEMENTS.items():
    full_path = ROOT / rel_path
    if full_path.exists():
        apply_replacements(full_path, replacements)

print("Patch application completed.")
