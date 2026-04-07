import { doc, getDoc } from "firebase/firestore";
import { getDb } from "../firebase/config";

export const CONFIG_COLLECTION = "config";
export const CONFIG_SITE_DOC_ID = "site";

export const TEXTO_LED_DEFAULT =
  "EQUIPO TÉCNICO MULTIMARCAS PARA SENDERISTAS Y MONTAÑISTAS";

export const CATEGORIAS_DEFAULT_SIN_TODOS = [
  "Calzado",
  "Camperas e impermeables",
  "Mochilas",
  "Accesorios",
  "Térmico",
  "Pack aventura",
];

export type SiteConfigLoaded = {
  marqueeText: string;
  categoriasSinTodos: string[];
};

export async function cargarConfigSitio(): Promise<SiteConfigLoaded> {
  const snap = await getDoc(
    doc(getDb(), CONFIG_COLLECTION, CONFIG_SITE_DOC_ID)
  );
  const d = snap.data();

  const marqueeRaw = d?.marqueeText;
  const marqueeText =
    typeof marqueeRaw === "string" && marqueeRaw.trim()
      ? marqueeRaw.trim()
      : TEXTO_LED_DEFAULT;

  const rawCats = d?.categorias;
  let categoriasSinTodos = [...CATEGORIAS_DEFAULT_SIN_TODOS];
  if (Array.isArray(rawCats)) {
    const cleaned = rawCats
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean);
    if (cleaned.length) categoriasSinTodos = cleaned;
  }

  return { marqueeText, categoriasSinTodos };
}
