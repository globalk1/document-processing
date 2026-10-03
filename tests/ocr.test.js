// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/services/api.js', () => ({ API_URL: 'https://example.test/api' }));
import { startOcrJob, getOcrJob, cancelOcrJob, validateOcrFile } from '../src/services/ocr.js';
const file = () => new File(['png'], 'exam.png', {type:'image/png'});
const reply = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json'}});
afterEach(() => vi.unstubAllGlobals());

describe('free OCR services', () => {
  it('uploads only an allowed local mode with cancellation receipt and without credentials', async () => {
    const fetch = vi.fn().mockResolvedValue(reply({success:true,job:{id:'one',status:'queued'}}));
    vi.stubGlobal('fetch',fetch);
    expect((await startOcrJob({file:file(),requestId:'uuid',mode:'local_ocr_latex'})).success).toBe(true);
    const [url,options] = fetch.mock.calls[0];
    expect(url).toBe('https://example.test/api/pdf/public-ocr/jobs/');
    expect(options.headers).toBeUndefined();
    expect(options.body.get('mode')).toBe('local_ocr_latex');
    expect(options.body.get('client_request_id')).toBe('uuid');
    expect(options.body.get('quality')).toBe('standard');
    const calls=fetch.mock.calls.length;
    expect((await startOcrJob({file:file(),requestId:'uuid',mode:'accurate'})).success).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(calls);
  });
  it('uses request cancellation before a job id is received and job cancellation as fallback', async () => {
    const fetch=vi.fn().mockResolvedValue(reply({success:true,cancelled:true}));vi.stubGlobal('fetch',fetch);
    await cancelOcrJob({requestId:'uuid'});
    expect(fetch.mock.calls[0][0]).toContain('/jobs/cancel/');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({client_request_id:'uuid'});
    await cancelOcrJob({jobId:'one'});
    expect(fetch.mock.calls[1][0]).toContain('/jobs/one/cancel/');
  });
  it('preserves HTTP errors and supports cancelling requests', async () => {
    const fetch=vi.fn().mockResolvedValue(reply({success:false,error:'worker unavailable',code:'local_ocr_unavailable'},503));vi.stubGlobal('fetch',fetch);
    expect(await getOcrJob({jobId:'one'})).toMatchObject({success:false,status:503,code:'local_ocr_unavailable',error:'worker unavailable'});
    fetch.mockImplementation((url,options) => options.signal.aborted ? Promise.reject(new DOMException('aborted','AbortError')) : Promise.resolve(reply({success:true})));
    const controller=new AbortController();controller.abort();
    expect(await getOcrJob({jobId:'one',signal:controller.signal})).toMatchObject({success:false,cancelled:true});
  });
  it('rejects oversized and unsupported inputs', () => {
    expect(validateOcrFile({name:'huge.pdf',type:'application/pdf',size:33*1024*1024})).toContain('32 MB');
    expect(validateOcrFile(new File(['doc'],'exam.docx'))).toContain('PDF');
    expect(validateOcrFile(file())).toBe('');
  });
});
