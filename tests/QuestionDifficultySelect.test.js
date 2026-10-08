import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { h, KeepAlive, ref } from "vue";
import QuestionDifficultySelect from "../src/components/QuestionDifficultySelect.vue";

let wrapper;
const dropdown = () => document.querySelector(".question-difficulty-menu");
function setup(props = {}) {
  wrapper = mount(QuestionDifficultySelect, { props, attachTo: document.body });
  return wrapper.find("button");
}
afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.restoreAllMocks();
});

describe("downward difficulty dropdown", () => {
  it("defaults to unclassified and positions its options below the field, even near the bottom edge", async () => {
    const button = setup();
    vi.spyOn(button.element, "getBoundingClientRect").mockReturnValue({ left: 40, bottom: window.innerHeight - 50, width: 220 });
    expect(button.text()).toBe("未分類");
    expect(wrapper.find("select").exists()).toBe(false);
    await button.trigger("click");
    expect(dropdown().parentElement).toBe(document.body);
    expect(dropdown().style.top).toBe(`${window.innerHeight - 44}px`);
    expect(dropdown().style.left).toBe("40px");
    expect(dropdown().style.width).toBe("220px");
    expect(dropdown().style.maxHeight).toBe("40px");
    expect([...dropdown().children].map((option) => option.dataset.value)).toEqual(["U", "C", "B", "A", "S"]);
    expect(button.attributes("aria-expanded")).toBe("true");
  });

  it("repositions below the field when the page scrolls or resizes", async () => {
    const button = setup();
    const bounds = vi.spyOn(button.element, "getBoundingClientRect").mockReturnValue({ left: 12, bottom: 120, width: 250 });
    await button.trigger("click");
    bounds.mockReturnValue({ left: 15, bottom: 180, width: 300 });
    window.dispatchEvent(new Event("scroll"));
    await flushPromises();
    expect(dropdown().style.top).toBe("186px");
    expect(dropdown().style.width).toBe("300px");
    bounds.mockReturnValue({ left: 30, bottom: 210, width: 350 });
    window.dispatchEvent(new Event("resize"));
    await flushPromises();
    expect(dropdown().style.top).toBe("216px");
    expect(dropdown().style.left).toBe("30px");
  });

  it("preserves an existing difficulty and emits one change when choosing another", async () => {
    const button = setup({ modelValue: "S", includeAll: true });
    expect(button.text()).toBe("S 究極型");
    await button.trigger("click");
    expect(dropdown().querySelector('[aria-selected="true"]').dataset.value).toBe("S");
    expect(dropdown().lastElementChild.textContent).toBe("全部難度");
    dropdown().querySelector('[data-value="B"]').click();
    await flushPromises();
    expect(wrapper.emitted("update:modelValue")).toEqual([["B"]]);
    expect(wrapper.emitted("change")).toEqual([["B"]]);
    expect(dropdown()).toBeNull();
    expect(document.activeElement).toBe(button.element);
  });

  it("supports arrows and Enter without submitting a surrounding form", async () => {
    const button = setup();
    await button.trigger("keydown", { key: "ArrowDown" });
    await button.trigger("keydown", { key: "ArrowDown" });
    const activeId = button.attributes("aria-activedescendant");
    expect(document.getElementById(activeId).dataset.value).toBe("C");
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    button.element.dispatchEvent(event);
    await flushPromises();
    expect(event.defaultPrevented).toBe(true);
    expect(wrapper.emitted("update:modelValue")).toEqual([["C"]]);
    expect(dropdown()).toBeNull();
  });

  it("dismisses with Escape, Tab, or an outside click without changing the value", async () => {
    const button = setup();
    for (const key of ["Escape", "Tab"]) {
      await button.trigger("click");
      await button.trigger("keydown", { key });
      expect(dropdown()).toBeNull();
    }
    await button.trigger("click");
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await flushPromises();
    expect(dropdown()).toBeNull();
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("does not fetch again when the current option is chosen and closes if disabled", async () => {
    const button = setup();
    await button.trigger("click");
    dropdown().querySelector('[data-value="U"]').click();
    await flushPromises();
    expect(wrapper.emitted("change")).toBeUndefined();
    await button.trigger("click");
    await wrapper.setProps({ disabled: true });
    expect(dropdown()).toBeNull();
    expect(button.element.disabled).toBe(true);
  });

  it("removes the teleported menu on page switches and unmount", async () => {
    const active = ref(true);
    wrapper = mount({
      setup: () => () => h(KeepAlive, null, { default: () => active.value ? h(QuestionDifficultySelect) : h("div", "other page") }),
    }, { attachTo: document.body });
    await wrapper.find("button").trigger("click");
    expect(dropdown()).not.toBeNull();
    active.value = false;
    await flushPromises();
    expect(dropdown()).toBeNull();
    active.value = true;
    await flushPromises();
    await wrapper.find("button").trigger("click");
    expect(dropdown()).not.toBeNull();
    wrapper.unmount();
    wrapper = null;
    expect(dropdown()).toBeNull();
  });
});
