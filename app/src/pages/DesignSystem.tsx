import { useState } from "react";
import {
  AppShell, Button, Card, Eyebrow, StatNumber,
  SegmentedTabs, Field, Input, SelectInput,
  ToastProvider, useToast, PageHeader,
  BrandMark, Wordmark,
} from "../components/ui";
import { Wallet, Bell, Leaf } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2
        className="mb-5 text-2xl font-medium text-ink-900"
        style={{ fontFamily: "'Fraunces', Georgia, serif" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className ?? ""}`}>
      {children}
    </div>
  );
}

function Swatch({ name, bg, text }: { name: string; bg: string; text?: string }) {
  return (
    <div className="flex flex-col gap-1.5 w-[100px]">
      <div
        className="h-14 w-full rounded-md border border-cream-200"
        style={{ background: bg }}
      />
      <span className="text-[11px] font-medium text-ink-700 leading-tight">{name}</span>
      <span className="text-[10px] text-ink-400">{text ?? bg}</span>
    </div>
  );
}

// ── Sub-page that can call useToast ──────────────────────────────────────────

function DesignSystemInner() {
  const toast = useToast();
  const [finTab, setFinTab] = useState("budget");
  const [houseTab, setHouseTab] = useState("goals");

  return (
    <AppShell>
      <PageHeader
        title="Design System"
        icon={<Leaf size={20} />}
        accessoryRight={
          <BrandMark size={28} />
        }
      />

      <div className="px-4 py-8 max-w-[760px] mx-auto">

        {/* ── Logo transparency test ────────────────────────── */}
        {/* TEMP: remove after confirming transparent background */}
        <Section title="Logo BG Test">
          <div className="flex gap-6 flex-wrap">
            <div style={{ background: "#FF00AA", padding: 16, borderRadius: 8, display: "inline-flex" }}>
              <img src="/src/assets/nestotter-logo.svg" style={{ height: 80 }} alt="logo on hot pink" />
            </div>
            <div style={{ background: "#1B4243", padding: 16, borderRadius: 8, display: "inline-flex" }}>
              <img src="/src/assets/nestotter-logo.svg" style={{ height: 80 }} alt="logo on teal" />
            </div>
            <div style={{ background: "#FAF6EE", padding: 16, borderRadius: 8, display: "inline-flex", border: "1px solid #ccc" }}>
              <img src="/src/assets/nestotter-logo.svg" style={{ height: 80 }} alt="logo on cream" />
            </div>
          </div>
        </Section>

        {/* ── Brand ─────────────────────────────────────────── */}
        <Section title="Brand">
          <Row className="mb-6">
            <Wordmark size="lg" />
            <Wordmark size="md" />
            <Wordmark size="sm" />
          </Row>
          <Row>
            <BrandMark size={64} />
            <BrandMark size={48} />
            <BrandMark size={32} />
            <BrandMark size={24} />
          </Row>
        </Section>

        {/* ── Color palette ─────────────────────────────────── */}
        <Section title="Color Palette">
          <Eyebrow as="p" className="mb-3">Teal (Primary)</Eyebrow>
          <Row className="mb-6">
            <Swatch name="teal-50"  bg="#E8F1F1" />
            <Swatch name="teal-100" bg="#C9DEDF" />
            <Swatch name="teal-300" bg="#6FA3A5" />
            <Swatch name="teal-500" bg="#2D6E70" text="#2D6E70 — primary" />
            <Swatch name="teal-600" bg="#245759" />
            <Swatch name="teal-700" bg="#1B4243" />
          </Row>

          <Eyebrow as="p" className="mb-3">Rust (Secondary)</Eyebrow>
          <Row className="mb-6">
            <Swatch name="rust-50"  bg="#FAEFE5" />
            <Swatch name="rust-100" bg="#F2D9C2" />
            <Swatch name="rust-300" bg="#D99A66" />
            <Swatch name="rust-500" bg="#C17A3F" text="#C17A3F — secondary" />
            <Swatch name="rust-600" bg="#A3632F" />
            <Swatch name="rust-700" bg="#7F4D25" />
          </Row>

          <Eyebrow as="p" className="mb-3">Neutrals</Eyebrow>
          <Row className="mb-6">
            <Swatch name="cream-50"  bg="#FAF6EE" />
            <Swatch name="cream-100" bg="#F5F1E8" />
            <Swatch name="cream-200" bg="#EDE7D8" />
            <Swatch name="ink-300"   bg="#A8B3BB" />
            <Swatch name="ink-500"   bg="#6B7A85" />
            <Swatch name="ink-700"   bg="#3F5260" />
            <Swatch name="ink-900"   bg="#1C2A33" />
          </Row>

          <Eyebrow as="p" className="mb-3">Semantic</Eyebrow>
          <Row>
            <Swatch name="success" bg="#3E8E5A" />
            <Swatch name="warning" bg="#D9A441" />
            <Swatch name="danger"  bg="#C0574E" />
            <Swatch name="bark-500" bg="#5C3A28" />
          </Row>
        </Section>

        {/* ── Typography ────────────────────────────────────── */}
        <Section title="Typography">
          <Card padding="md" className="mb-4">
            <Eyebrow as="p" className="mb-2">BANK BALANCE</Eyebrow>
            <StatNumber size="hero" className="text-ink-900">$2,087.11</StatNumber>
            <p className="mt-2 text-sm text-ink-700">
              You have <span className="text-teal-500 font-medium">$262.11</span> left to assign.
            </p>
          </Card>

          <Card padding="md" className="mb-4">
            <div className="flex items-baseline gap-3 mb-3">
              <StatNumber size="lg" className="text-teal-500">$18,500</StatNumber>
              <Eyebrow>Total Owed</Eyebrow>
            </div>
            <StatNumber size="md" className="text-ink-900">$4 left</StatNumber>
          </Card>

          <Card padding="md">
            <h1 className="text-2xl font-medium text-ink-900 mb-1"
              style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
              Page Title — Fraunces 500
            </h1>
            <h2 className="text-lg font-medium text-ink-700 mb-1"
              style={{ fontFamily: "'Fraunces', Georgia, serif" }}>
              Section Heading — Fraunces 500
            </h2>
            <p className="text-sm text-ink-700 mb-1">Body text — Inter 400. Warm, readable.</p>
            <p className="text-xs font-medium text-ink-500 mb-1">Label text — Inter 500 · 12px</p>
            <Eyebrow>Eyebrow label · Inter 600 · uppercase</Eyebrow>
          </Card>
        </Section>

        {/* ── Buttons ───────────────────────────────────────── */}
        <Section title="Buttons">
          <Card padding="md" className="mb-4">
            <Eyebrow as="p" className="mb-3">Variants</Eyebrow>
            <Row>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </Row>
          </Card>

          <Card padding="md" className="mb-4">
            <Eyebrow as="p" className="mb-3">Sizes</Eyebrow>
            <Row className="items-end">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </Row>
          </Card>

          <Card padding="md">
            <Eyebrow as="p" className="mb-3">With Icon / Disabled</Eyebrow>
            <Row>
              <Button variant="primary">
                <Wallet size={15} />
                Add Transaction
              </Button>
              <Button variant="secondary">
                <Bell size={15} />
                Remind me
              </Button>
              <Button variant="primary" disabled>Disabled</Button>
            </Row>
          </Card>
        </Section>

        {/* ── Cards ─────────────────────────────────────────── */}
        <Section title="Cards">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card padding="md">
              <Eyebrow as="p" className="mb-1">Default</Eyebrow>
              <p className="text-sm text-ink-700">Standard card with shadow-card. Warm off-white surface, cream-200 border.</p>
            </Card>

            <Card padding="md" interactive>
              <Eyebrow as="p" className="mb-1">Interactive</Eyebrow>
              <p className="text-sm text-ink-700">Tap me — scale 0.98 + hover elevation lift.</p>
            </Card>

            <Card padding="sm">
              <p className="text-sm text-ink-700">Small padding (12px)</p>
            </Card>

            <Card padding="lg">
              <p className="text-sm text-ink-700">Large padding (24px)</p>
            </Card>
          </div>
        </Section>

        {/* ── Segmented Tabs ────────────────────────────────── */}
        <Section title="Segmented Tabs">
          <Card padding="md" className="mb-4">
            <Eyebrow as="p" className="mb-3">Finances (fixed width)</Eyebrow>
            <SegmentedTabs
              layoutId="ds-fin"
              tabs={[
                { id: "budget",   label: "Budget" },
                { id: "bills",    label: "Bills" },
                { id: "debts",    label: "Debts" },
                { id: "spending", label: "Spending" },
              ]}
              activeId={finTab}
              onChange={setFinTab}
            />
          </Card>

          <Card padding="md">
            <Eyebrow as="p" className="mb-3">Household (scrollable)</Eyebrow>
            <SegmentedTabs
              layoutId="ds-house"
              scrollable
              tabs={[
                { id: "goals",    label: "Goals" },
                { id: "calendar", label: "Calendar" },
                { id: "recipes",  label: "Recipes" },
                { id: "meals",    label: "Meals" },
                { id: "chores",   label: "Chores" },
                { id: "grocery",  label: "Grocery" },
                { id: "notes",    label: "Notes" },
              ]}
              activeId={houseTab}
              onChange={setHouseTab}
            />
          </Card>
        </Section>

        {/* ── Fields ────────────────────────────────────────── */}
        <Section title="Fields">
          <Card padding="md">
            <div className="flex flex-col gap-4 max-w-sm">
              <Field label="Your name" htmlFor="ds-name" hint="This is shown to household members.">
                <Input id="ds-name" placeholder="Robert Ducharme" />
              </Field>

              <Field label="Amount" htmlFor="ds-amount">
                <Input id="ds-amount" type="number" placeholder="0.00" />
              </Field>

              <Field label="Category" htmlFor="ds-cat" error="Please choose a category.">
                <SelectInput id="ds-cat" hasError>
                  <option value="">Select…</option>
                  <option value="groceries">Groceries</option>
                  <option value="rent">Rent</option>
                </SelectInput>
              </Field>
            </div>
          </Card>
        </Section>

        {/* ── Toast ─────────────────────────────────────────── */}
        <Section title="Toast">
          <Card padding="md">
            <Eyebrow as="p" className="mb-3">Trigger toasts</Eyebrow>
            <Row>
              <Button variant="primary"
                onClick={() => toast("Transaction recorded!", "success")}>
                Success toast
              </Button>
              <Button variant="secondary"
                onClick={() => toast("Something went wrong.", "error")}>
                Error toast
              </Button>
              <Button variant="ghost"
                onClick={() => toast("Syncing in the background…", "info")}>
                Info toast
              </Button>
            </Row>
          </Card>
        </Section>

        {/* ── Page Header ───────────────────────────────────── */}
        <Section title="Page Header">
          <div className="rounded-lg overflow-hidden border border-cream-200">
            <PageHeader
              title="Overview"
              icon={<Wallet size={18} />}
              accessoryRight={
                <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold">
                  RD
                </div>
              }
            />
            <div className="p-4 bg-cream-50">
              <p className="text-sm text-ink-500">Page content goes here…</p>
            </div>
          </div>
        </Section>

        <div className="pb-8 text-center">
          <Wordmark size="sm" className="opacity-40" />
          <p className="mt-2 text-xs text-ink-300">Phase 1 — Foundation complete</p>
        </div>
      </div>
    </AppShell>
  );
}

// ── Export wraps with ToastProvider ──────────────────────────────────────────

export default function DesignSystem() {
  return (
    <ToastProvider>
      <DesignSystemInner />
    </ToastProvider>
  );
}
