import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import saved from "./reference.json" with { type: "json" };
const dom = new JSDOM("<body></body>", { url: "https://test.local" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = window.localStorage;
const { render, fireEvent, screen, cleanup, waitFor, within } =
  await import("@testing-library/react");
const { default: Studio } = await import("../lib/Studio.jsx");
const mount = () => render(React.createElement(Studio, { saved }));
test.afterEach(() => {
  cleanup();
  localStorage.clear();
});
test("five saved diagrams load without a provider request", () => {
  let calls = 0;
  globalThis.fetch = () => {
    calls++;
  };
  mount();
  assert.equal(screen.getAllByRole("img").length, 5);
  assert.equal(calls, 0);
});
test("decisions and notes survive remount; filters combine", () => {
  mount();
  fireEvent.click(screen.getAllByText("Approve", { selector: "button" })[0]);
  fireEvent.change(screen.getAllByLabelText("Review note")[0], {
    target: { value: "Triangle verified" },
  });
  cleanup();
  mount();
  fireEvent.click(screen.getByRole("button", { name: /Approved 1/ }));
  assert.equal(screen.getAllByRole("img").length, 1);
  assert.equal(screen.getByLabelText("Review note").value, "Triangle verified");
  fireEvent.change(screen.getByLabelText("Filter by subject"), {
    target: { value: "Physics" },
  });
  screen.getByText("No diagrams match these filters.");
});
test("API failure leaves the original results available", async () => {
  globalThis.fetch = async () =>
    Response.json({ error: "Quota exhausted" }, { status: 429 });
  mount();
  fireEvent.click(screen.getByText("Generate"));
  await screen.findByText("Quota exhausted");
  assert.equal(screen.getAllByRole("img").length, 5);
});
test("new live revision gets a fresh review and survives a refresh", async () => {
  let sent;
  globalThis.fetch = async (_, opts) => {
    sent = JSON.parse(opts.body);
    return Response.json({
      ...saved[1],
      revision: "new",
      model: "test-model",
      cost: 0,
    });
  };
  mount();
  fireEvent.click(screen.getAllByText("Reject", { selector: "button" })[1]);
  fireEvent.change(screen.getByLabelText("Concept to generate"), {
    target: { value: "circle" },
  });
  fireEvent.click(screen.getByText("Generate"));
  await screen.findByText("test-model");
  assert.equal(sent.id, "circle");
  cleanup();
  mount();
  const row = screen.getByText("test-model").closest("tr");
  within(row).getByText("Pending");
});
test("invalid live SVG cannot be approved", async () => {
  globalThis.fetch = async () =>
    Response.json({
      ...saved[0],
      revision: "failed",
      svg: null,
      passed: false,
    });
  mount();
  fireEvent.click(screen.getByText("Generate"));
  await waitFor(() =>
    assert.ok(screen.getByText("Diagram withheld after validation failed.")),
  );
  assert.ok(screen.getAllByText("Approve", { selector: "button" })[0].disabled);
});
