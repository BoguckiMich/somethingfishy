/**
 * The page's URL flags (?debug=, ?coins=, ?time=, ?reset= ...). They only exist on the dev server:
 * in a production build every parameter is ignored, so there is no sandbox and no flag.
 */
export function pageParams(): URLSearchParams {
  return import.meta.env.DEV ? new URLSearchParams(location.search) : new URLSearchParams();
}
