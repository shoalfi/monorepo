import { StatusBadge } from "@/components/dashboard/pills"

/**
 * Only lists work that exists and runs. The cap steward is deployed to sepolia
 * and reading a real published snapshot; the badge says "sepolia only" because
 * it is on no mainnet and no lending market consumes it. Items that were not
 * written at all are not advertised here.
 */
const ITEMS = [
  {
    title: "cap steward contract",
    detail: "live on sepolia: turns a published depth snapshot into a borrow cap",
    status: "sepolia only",
    href: "https://sepolia.etherscan.io/address/0x7Ec8Ee63f9eE8C9Fc1F6aC126575adf0E3e6431E",
  },
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
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium tracking-tight underline decoration-dotted underline-offset-4 hover:decoration-solid"
              >
                {item.title}
              </a>
              <StatusBadge label={item.status} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
