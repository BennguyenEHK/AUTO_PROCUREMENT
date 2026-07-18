export const views = ["documents", "pricing", "proposal", "signup"] as const;
export const tabs = ["rfq", "suppliers", "quotes", "technical", "certificates"] as const;

export type PageView = (typeof views)[number];
export type PageTab = (typeof tabs)[number];

export interface PageUrlState {
  view: PageView;
  tab: PageTab;
  rfqId: number | null;
}

export const defaultPageUrlState: PageUrlState = {
  view: "documents",
  tab: "rfq",
  rfqId: null
};

function includes<T extends readonly string[]>(values: T, value: string | null): value is T[number] {
  return value !== null && values.includes(value);
}

export function readPageUrlState(params: URLSearchParams): PageUrlState {
  const rawView = params.get("view");
  const rawTab = params.get("tab");
  const rawRfqId = params.get("rfqId");
  const parsedRfqId = Number(rawRfqId);

  return {
    view: includes(views, rawView) ? rawView : defaultPageUrlState.view,
    tab: includes(tabs, rawTab) ? rawTab : defaultPageUrlState.tab,
    rfqId: Number.isInteger(parsedRfqId) && parsedRfqId > 0 ? parsedRfqId : null
  };
}

export function writePageUrlState(state: PageUrlState, params = new URLSearchParams()): URLSearchParams {
  params.set("view", state.view);
  params.set("tab", state.tab);

  if (state.rfqId === null) {
    params.delete("rfqId");
  } else {
    params.set("rfqId", String(state.rfqId));
  }

  return params;
}
