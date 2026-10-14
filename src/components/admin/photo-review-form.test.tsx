import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PhotoReviewForm } from "./photo-review-form";

const data = { assetUrl: "https://example.com/a.jpg", originalSha256: "a".repeat(64), replacementSha256: "b".repeat(64), preview: "data:image/jpeg;base64,AA==", width: 1200, height: 800 };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("prepares without saving and discards late results after the selected asset changes", async () => {
  let finish!: (value: unknown) => void;
  const fetch = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetch);
  const onChange = vi.fn();
  const view = render(<PhotoReviewForm title="Título real" description="Descripción real" storyId="story-1" asset="https://example.com/a.jpg" source="" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisión de la foto" }));
  expect(fetch).toHaveBeenCalledWith("/api/admin/stories/story-1/image-review", expect.objectContaining({ method: "POST" }));
  view.rerender(<PhotoReviewForm title="Título real" description="Descripción real" storyId="story-1" asset="https://example.com/b.jpg" source="" onChange={onChange} />);
  finish({ ok: true, json: async () => ({ data }) });
  await waitFor(() => expect(screen.getByRole("button", { name: "Preparar revisión de la foto" })).not.toBeDisabled());
  expect(screen.queryByAltText("Encuadre de revisión en escritorio")).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('"status":"approved"'));
});

it("recovers from preparation failure and previews the actual story overlay", async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Foto no disponible" }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ data }) });
  vi.stubGlobal("fetch", fetch);
  render(<PhotoReviewForm title="Título real" description="Descripción real" storyId="story-1" asset="https://example.com/a.jpg" source="" onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisión de la foto" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Foto no disponible");
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisión de la foto" }));
  expect(await screen.findByAltText("Encuadre de revisión en escritorio")).toHaveAttribute("src", data.preview);
  expect(screen.getAllByText("Título real")).toHaveLength(2);
  expect(screen.getAllByText("Descripción real")).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Confirmar revisión de la foto" })).toBeDisabled();
});

function fillReviewFields() {
  for (const [label, value] of Object.entries({ "Página de origen (HTTPS)": "https://example.com/source", "Fotógrafo/a": "Fotógrafa", "Prueba de permiso / registro conservado": "Permiso escrito conservado", "Fecha de revisión": "2026-10-13", "Crédito mostrado": "Fotógrafa", "Descripción precisa de la imagen": "Lugar verificado", "Nombre de quien revisa": "Operador", "Notas del encuadre en móvil": "Centro revisado", "Notas del encuadre en escritorio": "Centro revisado", "Registro o pruebas de permiso y revisión visual": "Registro conservado" })) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.change(screen.getByLabelText("Licencia"), { target: { value: "owner-permission" } });
  fireEvent.change(screen.getByLabelText("Contexto de la imagen"), { target: { value: "named-place" } });
  fireEvent.click(screen.getByRole("checkbox"));
}

it("does not install a late confirmation after review fields change", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) }));
  const onChange = vi.fn();
  render(<PhotoReviewForm title="Título real" description="Descripción real" storyId="story-1" asset="https://example.com/a.jpg" source="" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisión de la foto" }));
  await screen.findByAltText("Encuadre de revisión en escritorio");
  fillReviewFields();
  let finish!: (value: ArrayBuffer) => void;
  const digest = vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(() => new Promise<ArrayBuffer>(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar revisión de la foto" }));
  fireEvent.change(screen.getByLabelText("Crédito mostrado"), { target: { value: "Crédito corregido" } });
  finish(new ArrayBuffer(32));
  await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked());
  expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('"status":"approved"'));
  digest.mockRestore();
});

it.each([new TypeError("Synthetic connection failure"), "Synthetic non-Error network rejection"])("shows preparation failure and allows a corrected retry: %s", async failure => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce({ ok: true, json: async () => ({ data }) }));
  render(<PhotoReviewForm title="Título" description="Descripción" storyId="story-1" asset="https://example.com/a.jpg" source="" onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisión de la foto" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(failure instanceof Error ? failure.message : "No se pudo preparar la foto");
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisión de la foto" }));
  expect(await screen.findByAltText("Encuadre de revisión en escritorio")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("ignores a late preparation rejection after another asset is selected", async () => {
  let reject!: (value: Error) => void;
  vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; })).mockResolvedValueOnce({ ok: true, json: async () => ({ data }) }));
  const view = render(<PhotoReviewForm title="Título" description="Descripción" storyId="story-1" asset="https://example.com/a.jpg" source="" onChange={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisión de la foto" }));
  view.rerender(<PhotoReviewForm title="Título" description="Descripción" storyId="story-1" asset="https://example.com/b.jpg" source="" onChange={vi.fn()} />);
  reject(new Error("Obsolete image failure"));
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisión de la foto" }));
  expect(await screen.findByAltText("Encuadre de revisión en escritorio")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it.each(["", "Referencia conservada pero formulario incompleto"])("[case %#] keeps incomplete review draft unapproved after confirmation error", async receipt => {
  const onChange = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) }));
  render(<PhotoReviewForm title="Título" description="Descripción" storyId="story-1" asset="https://example.com/a.jpg" source="" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisión de la foto" }));
  await screen.findByAltText("Encuadre de revisión en escritorio");
  if (receipt) fireEvent.change(screen.getByLabelText("Registro o pruebas de permiso y revisión visual"), { target: { value: receipt } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar revisión de la foto" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(receipt ? "Completa todos los campos" : "Indica las pruebas de permiso");
  expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('"status":"approved"'));
  expect(screen.getByRole("button", { name: "Confirmar revisión de la foto" })).not.toBeDisabled();
});

it("keeps approval pending when browser crypto rejects and recovers on retry", async () => {
  const onChange = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) }));
  render(<PhotoReviewForm title="Título" description="Descripción" storyId="story-1" asset="https://example.com/a.jpg" source="" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisión de la foto" }));
  await screen.findByAltText("Encuadre de revisión en escritorio");
  fillReviewFields();
  vi.spyOn(crypto.subtle, "digest").mockRejectedValueOnce("Synthetic browser crypto rejection");
  fireEvent.click(screen.getByRole("button", { name: "Confirmar revisión de la foto" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Completa la revisión de la foto");
  expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('"status":"approved"'));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar revisión de la foto" }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.stringContaining('"status":"approved"')));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it.each(["fields", "asset"] as const)("ignores delayed crypto failure after the reviewed %s changes", async changed => {
  const onChange = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data }) }));
  const view = render(<PhotoReviewForm title="Título" description="Descripción" storyId="story-1" asset="https://example.com/a.jpg" source="" onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Preparar revisión de la foto" }));
  await screen.findByAltText("Encuadre de revisión en escritorio");
  fillReviewFields();
  let rejectDigest!: (error: Error) => void;
  vi.spyOn(crypto.subtle, "digest").mockImplementationOnce(() => new Promise<ArrayBuffer>((_resolve, reject) => { rejectDigest = reject; }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar revisión de la foto" }));
  if (changed === "fields") {
    fireEvent.change(screen.getByLabelText("Crédito mostrado"), { target: { value: "Crédito corregido durante la revisión" } });
  } else {
    view.rerender(<PhotoReviewForm title="Título" description="Descripción" storyId="story-1" asset="https://example.com/b.jpg" source="" onChange={onChange} />);
  }
  await act(async () => { rejectDigest(new Error("Failure belonging to the obsolete review")); });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('"status":"approved"'));
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  if (changed === "fields") expect(screen.getByLabelText("Crédito mostrado")).toHaveValue("Crédito corregido durante la revisión");
  else expect(screen.queryByAltText("Encuadre de revisión en escritorio")).not.toBeInTheDocument();
});
