import { describe, expect, it, vi } from "vitest";
import { hashVoucherCode } from "../../src/lib/booking/vouchers";
import { createVoucher, parseVoucherArgs } from "./create-voucher";

describe("parseVoucherArgs", () => {
  it("applies the plan's defaults and targets the local stack unless told otherwise", () => {
    expect(parseVoucherArgs(["--label", "judges-2026"])).toEqual({
      label: "judges-2026",
      max: 50,
      expires: "2026-12-16",
      voice: true,
      turns: 60,
      attempts: 10,
      replace: null,
      target: "local",
      confirmProduction: false,
    });
  });

  it("reads every option", () => {
    expect(
      parseVoucherArgs([
        "--label", "testers",
        "--max", "5",
        "--expires", "2026-11-30",
        "--no-voice",
        "--turns", "20",
        "--attempts", "3",
        "--replace", "old-label",
        "--target", "production",
        "--yes-production",
      ])
    ).toEqual({
      label: "testers",
      max: 5,
      expires: "2026-11-30",
      voice: false,
      turns: 20,
      attempts: 3,
      replace: "old-label",
      target: "production",
      confirmProduction: true,
    });
  });

  it.each([
    [[]],
    [["--label", "x", "--max", "0"]],
    [["--label", "x", "--expires", "16/12/2026"]],
    [["--label", "x", "--target", "staging"]],
    [["--label", "x", "--unknown"]],
  ])("rejects %j", (argv) => {
    expect(() => parseVoucherArgs(argv)).toThrow();
  });
});

describe("createVoucher", () => {
  function fakeClient() {
    const calls: string[] = [];
    const revoke = { neq: vi.fn(async () => ({ error: null })) };
    const notRevoked = { is: vi.fn(() => revoke) };
    const update = { eq: vi.fn(() => notRevoked) };
    const insert = vi.fn(async () => {
      calls.push("insert");
      return { error: null };
    });
    const from = vi.fn(() => ({
      insert,
      update: vi.fn(() => {
        calls.push("revoke");
        return update;
      }),
    }));
    return { client: { from } as never, insert, update, notRevoked, revoke, calls };
  }

  it("stores only the hash and returns the code once", async () => {
    const fake = fakeClient();
    const options = parseVoucherArgs(["--label", "judges-2026"]);

    const { code } = await createVoucher(fake.client, options);

    expect(code).toMatch(/^[A-Z2-7]{52}$/);
    expect(fake.insert).toHaveBeenCalledWith({
      code_hash: hashVoucherCode(code),
      label: "judges-2026",
      expires_at: "2026-12-16T23:59:59+01:00",
      max_redemptions: 50,
      chat_turns_limit: 60,
      booking_attempts_limit: 10,
      grants_voice_pass: true,
    });
    expect(JSON.stringify(fake.insert.mock.calls)).not.toContain(code);
    expect(fake.calls).toEqual(["insert"]);
  });

  it("with --replace, issues the new code first, then revokes the label's other active codes", async () => {
    const fake = fakeClient();
    const { code } = await createVoucher(fake.client, parseVoucherArgs(["--label", "judges-2026", "--replace", "judges-2026"]));

    expect(fake.calls).toEqual(["insert", "revoke"]);
    expect(fake.update.eq).toHaveBeenCalledWith("label", "judges-2026");
    expect(fake.notRevoked.is).toHaveBeenCalledWith("revoked_at", null);
    expect(fake.revoke.neq).toHaveBeenCalledWith("code_hash", hashVoucherCode(code));
  });
});
