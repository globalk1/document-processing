import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import QuestionFilterSelect from '../src/components/QuestionFilterSelect.vue';
import { filterMatches, reconcileUnits, singleFilterValue } from '../src/utils/questionFilters';
import { searchStaffMathBankQuestions } from '../src/services/api';
let wrapper;
afterEach(() => { wrapper?.unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function setup() {
  wrapper = mount(QuestionFilterSelect, { attachTo: document.body, props: {
    label: '來源', modelValue: '',
    options: [{ value: '__none__', label: '無' }, { value: '', label: '全部來源' },
      { value: '康軒七上', label: '康軒七上' }, { value: '康軒八上', label: '康軒八上' }, { value: '南一七上', label: '南一七上' }],
    'onUpdate:modelValue': value => wrapper.setProps({ modelValue: value }),
  }});
  return wrapper.find('input');
}
const option = value => document.querySelector(`.question-filter-menu [data-value="${value}"]`);
it('shows a display-only field placeholder and retains the real all option', async () => {
  const input = setup();
  expect(input.element.value).toBe(''); expect(input.attributes('placeholder')).toBe('來源');
  await input.trigger('focus');
  expect(option('__none__')).toBeNull(); expect(option('')).not.toBeNull();
  expect(document.querySelector('.question-filter-menu').textContent).not.toContain('☐');
  option('南一七上').click(); await flushPromises();
  expect(wrapper.emitted('change')).toEqual([['南一七上']]);
  expect(document.querySelector('.question-filter-menu')).toBeNull();
});
it('long press checks once, preserves typed search and retains selections after closing', async () => {
  vi.useFakeTimers(); const input = setup(); await input.setValue('康軒');
  option('康軒七上').dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
  await vi.advanceTimersByTimeAsync(1000);
  option('康軒七上').dispatchEvent(new Event('pointerup', { bubbles: true }));
  option('康軒七上').click(); await flushPromises();
  expect(wrapper.emitted('change')).toEqual([[['康軒七上']]]);
  expect(input.element.value).toBe('康軒');
  option('康軒八上').click(); await flushPromises();
  expect(wrapper.props('modelValue')).toEqual(['康軒七上', '康軒八上']);
  expect(input.element.value).toBe('康軒');
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); await flushPromises();
  expect(input.element.value).toBe('已選 2 項');
  await input.trigger('focus');
  expect(option('康軒七上').getAttribute('aria-selected')).toBe('true');
  expect(option('康軒八上').getAttribute('aria-selected')).toBe('true');
  option('').click(); await flushPromises();
  expect(wrapper.props('modelValue')).toBe('');
});
it('does not select on IME Enter or cancelled holds and supports the keyboard alternative', async () => {
  vi.useFakeTimers(); const input = setup(); await input.setValue('康軒');
  await input.trigger('compositionstart'); await input.trigger('keydown', { key: 'Enter', isComposing: true });
  expect(wrapper.emitted('change')).toBeUndefined(); await input.trigger('compositionend');
  option('康軒七上').dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }));
  option('康軒七上').dispatchEvent(new Event('pointercancel', { bubbles: true }));
  await vi.advanceTimersByTimeAsync(1000); expect(wrapper.emitted('change')).toBeUndefined();
  await input.trigger('keydown', { key: 'Enter', shiftKey: true });
  await input.trigger('keydown', { key: 'ArrowDown' }); await input.trigger('keydown', { key: 'Enter' });
  expect(wrapper.props('modelValue')).toEqual(['康軒七上']); expect(input.element.value).toBe('康軒');
});
it('reconciles units across selected grades without copying arrays into single-value forms', () => {
  const units = [{ id: 'u1', grade: 'g1' }, { id: 'u2', grade: 'g2' }];
  expect(reconcileUnits(['u1', 'u2'], ['g2'], units, unit => unit.grade)).toEqual(['u2']);
  expect(filterMatches(['g1', 'g2'], 'g2')).toBe(true);
  expect(singleFilterValue(['g1', 'g2'])).toBe(''); expect(singleFilterValue(['g1'])).toBe('g1');
});
it('sends repeated API parameters and keeps source names with commas intact', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
  vi.stubGlobal('fetch', fetchMock);
  await searchStaffMathBankQuestions({ grade_id: ['g1', 'g2'], question_source: ['康軒,上', '南一'], search: '數學' }, { subject: 'math' });
  const url = new URL(fetchMock.mock.calls[0][0]);
  expect(url.searchParams.getAll('grade_id')).toEqual(['g1', 'g2']);
  expect(url.searchParams.getAll('question_source')).toEqual(['康軒,上', '南一']);
  expect(url.searchParams.get('search')).toBe('數學');
});
