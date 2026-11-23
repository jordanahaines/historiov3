"use client";

import { FilterValueInput } from "@/components/library/filter/FilterValueInput";
import type { SelectOption } from "@/components/library/filter/MultiSelect";
import {
  defaultValue,
  type Condition,
  type FieldDef,
  type Join,
  type OptionsKey,
} from "@/lib/library/filter-conditions";

type FilterConditionRowProps = {
  index: number;
  join: Join;
  condition: Condition;
  /** `never` so insight and highlight field lists are both accepted. */
  fields: FieldDef<never>[];
  optionsFor: (key: OptionsKey) => SelectOption[];
  onJoinChange: (join: Join) => void;
  onChange: (next: Condition) => void;
  onRemove: () => void;
};

const select =
  "border-border-strong bg-paper focus:border-link h-[30px] cursor-pointer border px-2 text-[13px] focus:outline-none";

/** One condition: join word, field, operator, value and a remove button. */
export function FilterConditionRow({
  index,
  join,
  condition,
  fields,
  optionsFor,
  onJoinChange,
  onChange,
  onRemove,
}: FilterConditionRowProps) {
  const field = fields.find((f) => f.id === condition.field) ?? fields[0]!;
  const op = field.ops.find((o) => o.id === condition.op) ?? field.ops[0]!;

  function changeField(id: string) {
    const next = fields.find((f) => f.id === id)!;
    const nextOp = next.ops[0]!;
    onChange({
      field: next.id,
      op: nextOp.id,
      value: defaultValue(nextOp.kind),
    });
  }

  function changeOp(id: string) {
    const nextOp = field.ops.find((o) => o.id === id)!;
    onChange({
      ...condition,
      op: nextOp.id,
      value:
        nextOp.kind === op.kind ? condition.value : defaultValue(nextOp.kind),
    });
  }

  return (
    <div
      role="group"
      aria-label={`Condition ${index + 1}`}
      className="flex items-start gap-2"
    >
      <div className="flex h-[30px] w-14 shrink-0 items-center text-xs">
        {index === 0 ? (
          <span className="text-ink-secondary">Where</span>
        ) : index === 1 ? (
          <select
            aria-label="Join conditions with"
            value={join}
            onChange={(event) => onJoinChange(event.target.value as Join)}
            className={`${select} w-full px-1`}
          >
            <option value="and">and</option>
            <option value="or">or</option>
          </select>
        ) : (
          <span className="text-ink-secondary">{join}</span>
        )}
      </div>
      <select
        aria-label="Field"
        value={field.id}
        onChange={(event) => changeField(event.target.value)}
        className={`${select} w-36 shrink-0`}
      >
        {fields.map((f) => (
          <option key={f.id} value={f.id}>
            {f.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Operator"
        value={op.id}
        onChange={(event) => changeOp(event.target.value)}
        className={`${select} w-28 shrink-0`}
      >
        {field.ops.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <div className="flex min-w-0 flex-1 items-center">
        <FilterValueInput
          kind={op.kind}
          fieldLabel={field.label}
          value={condition.value}
          options={field.options ? optionsFor(field.options) : []}
          onChange={(value) => onChange({ field: field.id, op: op.id, value })}
        />
      </div>
      <button
        type="button"
        aria-label="Remove condition"
        onClick={onRemove}
        className="text-ink-muted hover:text-ink focus-visible:outline-link flex h-[30px] w-5 shrink-0 cursor-pointer items-center justify-center focus-visible:outline-2"
      >
        ×
      </button>
    </div>
  );
}
