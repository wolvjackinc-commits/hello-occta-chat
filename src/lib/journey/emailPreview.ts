export function emailPreviewDocument(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('script, iframe, frame, object, embed, base, meta, link, form, input, button, video, audio, source, svg, math').forEach((element) => element.remove());
  document.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name) || ['href', 'src', 'srcset', 'action', 'formaction', 'background', 'ping', 'srcdoc', 'target'].includes(attribute.name.toLowerCase())) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; form-action 'none'; base-uri 'none'"><meta charset="utf-8"></head><body>${document.body.innerHTML}</body></html>`;
}
