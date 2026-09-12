import { StatusBadge } from "@/components/dashboard/pills"

/**
 * Only lists work that exists in the repo. The cap steward is a real contract
 * with passing tests (contracts/) that is not deployed. Items that were not
 * written at all are not advertised here.
 */
const ITEMS = [
  { title: "cap steward contract", detail: "clamps borrow caps to safe cap", status: "not deployed" },
]

export function Roadmap() {
  return (
    <div className="border-x border-b border-border">
      <p className="border-b border-border px-4 py-2 font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase">
        roadmap
      </p>
      <ul className="grid md:grid-cols-1">
        {ITEMS.map((item, index) => (
          <li
            key={item.title}
            className={`px-4 py-3 ${index < ITEMS.length - 1 ? "border-b border-border md:border-r md:border-b-0" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium tracking-tight">{item.title}</span>
              <StatusBadge label={item.status} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
