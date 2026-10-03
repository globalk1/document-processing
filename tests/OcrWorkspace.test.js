import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import OcrWorkspace from '../src/components/OcrWorkspace.vue';
const api=vi.hoisted(()=>({startOcrJob:vi.fn(),getOcrJob:vi.fn(),cancelOcrJob:vi.fn()}));
vi.mock('../src/services/ocr.js',async(importOriginal)=>({...await importOriginal(),...api}));
const job=(status='queued',extra={})=>({id:'a'.repeat(32),filename:'exam.pdf',mode:'local_ocr_latex',status,current:0,total:2,text:'',...extra});
let wrapper;
const buttons=()=>[...wrapper.element.querySelectorAll('button')];
const button=(label)=>buttons().find(b=>b.textContent.trim()===label);
async function click(label){button(label).click();await nextTick();await flushPromises();}
async function select(name='exam.pdf'){
 const input=wrapper.find('input[type=file]');Object.defineProperty(input.element,'files',{configurable:true,value:[new File(['pdf'],name,{type:'application/pdf'})]});await input.trigger('change');
}
async function tick(){await vi.advanceTimersByTimeAsync(1800);await flushPromises();}
beforeEach(()=>{
 vi.useFakeTimers();vi.resetAllMocks();sessionStorage.clear();
 api.startOcrJob.mockResolvedValue({success:true,job:job()});api.getOcrJob.mockResolvedValue({success:true,job:job('running')});
 api.cancelOcrJob.mockResolvedValue({success:true,cancelled:true,job:job('cancelled')});
 vi.stubGlobal('crypto',{randomUUID:()=> '123e4567-e89b-42d3-a456-426614174000'});
 vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:vi.fn(()=> 'blob:ocr'),revokeObjectURL:vi.fn()}));
});
afterEach(()=>{wrapper?.unmount();wrapper=null;sessionStorage.clear();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();});
function setup(){wrapper=mount(OcrWorkspace,{attachTo:document.body});}

describe('free 4 GB OCR workspace',()=>{
 it('provides anonymous text and math modes without login or paid analysis',async()=>{
  setup();expect(wrapper.find('input[type=password]').exists()).toBe(false);expect(button('開始解析').disabled).toBe(true);
  await select();await click('開始解析');
  expect(api.startOcrJob.mock.calls[0][0]).toMatchObject({mode:'local_ocr_latex',requestId:'123e4567-e89b-42d3-a456-426614174000'});
  expect(wrapper.text()).toContain('不呼叫付費 AI');expect(button('開始解析')).toBeUndefined();
 });
 it('shows partial pages and completes with editable math text and review diagnostics',async()=>{
  setup();await select();await click('開始解析');
  api.getOcrJob.mockResolvedValueOnce({success:true,job:job('running',{current:1,text:'第一頁'})}).mockResolvedValueOnce({success:true,job:job('success',{current:2,text:'第 1 題 $x+2$',diagnostics:{math_review_required:true,colored_ink_filtered:true}})});
  await tick();expect(wrapper.find('textarea').element.value).toBe('第一頁');expect(wrapper.find('textarea').element.readOnly).toBe(true);
  await tick();expect(wrapper.find('textarea').element.value).toBe('第 1 題 $x+2$');expect(wrapper.find('textarea').element.readOnly).toBe(false);
  expect(wrapper.text()).toContain('彩色筆跡');expect(button('下載 Markdown').disabled).toBe(false);expect(button('開始解析').disabled).toBe(false);
 });
 it('cancels the server job and ignores a late upload response',async()=>{
  let finish;api.startOcrJob.mockImplementation(()=>new Promise(resolve=>finish=resolve));setup();await select();await click('開始解析');
  await click('確認停止工作');expect(api.cancelOcrJob.mock.calls[0][0].requestId).toBe('123e4567-e89b-42d3-a456-426614174000');
  finish({success:true,job:job('success',{text:'late'})});await flushPromises();expect(wrapper.find('textarea').element.value).toBe('');expect(api.getOcrJob).not.toHaveBeenCalled();
 });
 it('preserves partial output when stopped and blocks resubmission if cancellation fails',async()=>{
  setup();await select();await click('開始解析');api.cancelOcrJob.mockResolvedValueOnce({success:false,error:'offline'});
  await click('停止解析');expect(wrapper.text()).toContain('重新確認停止');expect(button('解析中').disabled).toBe(true);
  api.cancelOcrJob.mockResolvedValueOnce({success:true,cancelled:true,job:job('cancelled',{text:'completed page'})});
  await click('確認停止工作');expect(wrapper.find('textarea').element.value).toBe('completed page');expect(button('開始解析').disabled).toBe(false);
 });
 it('recovers a job after refresh without starting duplicate work',async()=>{
  sessionStorage.setItem('huanyu-active-ocr-v1',JSON.stringify({id:'a'.repeat(32),requestId:'request',filename:'exam.pdf',mode:'local_ocr'}));
  api.getOcrJob.mockResolvedValueOnce({success:true,job:job('success',{mode:'local_ocr',text:'recovered'})});setup();await flushPromises();
  expect(api.startOcrJob).not.toHaveBeenCalled();expect(api.getOcrJob).toHaveBeenCalledTimes(1);expect(wrapper.find('textarea').element.value).toBe('recovered');expect(button('下載 TXT')).toBeDefined();
 });
 it('keeps an uncertain upload tracked until server cancellation is confirmed',async()=>{
  api.startOcrJob.mockResolvedValue({success:false,status:0,error:'network'});setup();await select();await click('開始解析');
  expect(wrapper.text()).toContain('確認停止工作');expect(button('解析中').disabled).toBe(true);expect(sessionStorage.getItem('huanyu-active-ocr-v1')).not.toBeNull();
  await click('確認停止工作');expect(button('開始解析').disabled).toBe(false);
 });
 it('reports missing worker configuration and allows another attempt',async()=>{
  api.startOcrJob.mockResolvedValue({success:false,status:503,code:'local_ocr_unavailable',error:'4 GB OCR 主機尚未連接'});setup();await select();await click('開始解析');
  expect(wrapper.text()).toContain('主機尚未連接');expect(button('開始解析').disabled).toBe(false);expect(sessionStorage.getItem('huanyu-active-ocr-v1')).toBeNull();
 });
 it('pauses after repeated query failures, then can reconnect without duplicate uploads',async()=>{
  setup();await select();await click('開始解析');api.getOcrJob.mockResolvedValue({success:false,status:0,error:'offline'});
  await tick();await tick();await tick();expect(button('重新查詢進度')).toBeDefined();
  api.getOcrJob.mockResolvedValue({success:true,job:job('success',{text:'done'})});await click('重新查詢進度');
  expect(wrapper.find('textarea').element.value).toBe('done');expect(api.startOcrJob).toHaveBeenCalledTimes(1);
 });
});
