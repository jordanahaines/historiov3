// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { MultiSelect } from "@/components/library/filter/MultiSelect";

const options = Array.from({ length: 200 }, (_, i) => ({
  value: `b${i}`,
  label: `Book ${i}`,
}));

function Harness() {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <MultiSelect
        label="Book"
        options={options}
        selected={selected}
        onChange={setSelected}
      />
      <output aria-label="count">{selected.length}</output>
    </>
  );
}

afterEach(cleanup);

describe("MultiSelect", () => {
  it("selects all matches of a typed search, then clears", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Book search" });
    fireEvent.change(input, { target: { value: "Book 19" } });
    // Book 19 and Book 190-199.
    fireEvent.click(
      screen.getByRole("button", { name: "Select all 11 matches" }),
    );
    expect(screen.getByLabelText("count").textContent).toBe("11");
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.getByLabelText("count").textContent).toBe("0");
  });

  it("removes the last tag with Backspace in an empty box", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Book search" });
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole("option", { name: "Book 3" }));
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(screen.getByLabelText("count").textContent).toBe("0");
  });
});
