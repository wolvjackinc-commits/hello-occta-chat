import { describe, expect, it } from 'vitest';
import { emailPreviewDocument } from '../emailPreview';

describe('saved reminder preview', () => {
  it('preserves message text but prevents tracking and navigation', () => {
    const preview = emailPreviewDocument('<p>Hello customer</p><img src="https://tracker.test/open?id=1"><a href="https://example.test/order/secret">Resume</a><script>alert(1)</script>');
    const document = new DOMParser().parseFromString(preview, 'text/html');
    expect(document.body.textContent).toContain('Hello customer');
    expect(document.body.textContent).toContain('Resume');
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('[src], [href]')).toBeNull();
    expect(document.querySelector('meta[http-equiv]')?.getAttribute('content')).toContain("default-src 'none'");
  });
  it('blocks active content, tracking styles and nested documents', () => {
    const preview = emailPreviewDocument('<meta http-equiv="refresh" content="0;url=https://tracker.test"><iframe srcdoc="bad"></iframe><form action="https://tracker.test"><input></form><div onmouseover="fetch(1)" style="background:url(https://tracker.test)">Message</div>');
    const document = new DOMParser().parseFromString(preview, 'text/html');
    expect(document.querySelector('iframe,form,input,[onmouseover],meta[http-equiv="refresh"]')).toBeNull();
    expect(document.querySelector('meta[http-equiv]')?.getAttribute('content')).toContain("img-src 'none'");
    expect(document.body.textContent).toContain('Message');
  });
});
