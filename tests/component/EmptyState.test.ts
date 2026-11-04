import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import EmptyState from '../../src/components/EmptyState.vue'
it('空状态提供说明和可操作入口，文本不会作为 HTML 注入', () => {
  const wrapper = mount(EmptyState, {
    props: { title: '<img src=x onerror=alert(1)>', description: '先添加物品' },
    slots: { default: '<button>添加物品</button>' },
  })
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.text()).toContain('<img')
  expect(wrapper.get('button').text()).toBe('添加物品')
})
