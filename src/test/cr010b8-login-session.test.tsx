// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useSession } from "@/lib/supabase/client";

function LoginTypingProbe() {
  const [email, setEmail] = useState("");
  const session = useSession();
  return (
    <div>
      <label htmlFor="session-probe-email">E-mail</label>
      <input id="session-probe-email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <output data-testid="session-status">{session.status}</output>
    </div>
  );
}

afterEach(() => cleanup());

describe("CR-010B.8 — session store stability", () => {
  it("keeps form input mounted through repeated changes without a render loop", async () => {
    render(<LoginTypingProbe />);
    const field = screen.getByRole("textbox", { name: "E-mail" });
    for (const value of ["c", "cr", "cri", "criatto"]) {
      fireEvent.change(field, { target: { value } });
      expect(field).toHaveValue(value);
    }
    await act(async () => {});
    expect(field).toHaveValue("criatto");
    await waitFor(() => expect(screen.getByTestId("session-status")).toHaveTextContent(/loading|unauthenticated/));
  });
});
