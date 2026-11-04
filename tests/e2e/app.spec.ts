import { expect, test, type Page } from '@playwright/test'
import { resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
async function create(page: Page, name: string, mode = '按次数', price = '399.99') {
  await page.goto('/#/items/new')
  await page.getByLabel('物品名称').fill(name)
  await page.getByLabel('购买价格').fill(price)
  await page.getByText(mode, { exact: true }).click()
  await page.getByRole('button', { name: '保存物品', exact: true }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}
test('完整物品、日志更正、回收站和恢复闭环', async ({ page }) => {
  await create(page, '验收耳机')
  await page.getByRole('button', { name: '验收耳机：+1' }).dblclick()
  await expect(page.getByText('1 次', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '查看使用历史' }).click()
  await page.getByRole('link', { name: /编辑 .* 的记录/ }).click()
  await page.getByLabel('使用次数').fill('5')
  await page.getByRole('button', { name: '保存使用记录' }).click()
  await expect(page.getByText('5 次', { exact: true })).toBeVisible()
  await page.goto('/#/items')
  await page
    .getByRole('link')
    .filter({ has: page.getByRole('heading', { name: '验收耳机', exact: true }) })
    .click()
  await expect(page.getByText('¥80.00', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: '编辑物品' }).click()
  await expect(page.getByRole('radio').first()).toBeDisabled()
  await page.getByLabel('当前状态').selectOption('stored')
  await page.getByRole('button', { name: '保存物品' }).click()
  await expect(page.getByRole('button', { name: '验收耳机：+1' })).toBeDisabled()
  await page.getByRole('button', { name: '移至回收站', exact: true }).click()
  await page.getByRole('button', { name: '移至回收站', exact: true }).last().click()
  await page.waitForURL('**/#/items')
  await page.goto('/#/recycle')
  await expect(page.getByRole('heading', { name: '验收耳机', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '恢复', exact: true }).click()
  await expect(page.getByRole('heading', { name: '验收耳机', exact: true })).toHaveCount(0)
  await page.goto('/#/items')
  await expect(page.getByRole('heading', { name: '验收耳机', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: '验收耳机', exact: true })).toBeVisible()
  await expect(page.locator('body')).toHaveJSProperty(
    'scrollWidth',
    await page.evaluate(() => document.documentElement.clientWidth)
  )
})
test('三种模式、校验与未保存修改保护', async ({ page }) => {
  await page.goto('/#/items/new')
  await page.getByRole('button', { name: '保存物品' }).click()
  await expect(page.getByText('请填写物品名称')).toBeVisible()
  await page.getByLabel('物品名称').fill('校验')
  await page.getByLabel('购买价格').fill('0.001')
  await page.getByRole('button', { name: '保存物品' }).click()
  await expect(page.getByText(/最多两位小数/)).toBeVisible()
  await page.getByRole('button', { name: '返回', exact: true }).click()
  await expect(page.getByText('放弃未保存的修改？')).toBeVisible()
  await page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(page.getByLabel('物品名称')).toHaveValue('校验')
  await page.getByLabel('购买价格').fill('0')
  await page.getByText('按时长', { exact: true }).click()
  await page.getByRole('button', { name: '保存物品' }).click()
  await page.getByRole('button', { name: '校验：记录时长' }).click()
  await page.getByRole('button', { name: '90 分钟', exact: true }).click()
  await page.getByRole('button', { name: '保存使用记录' }).click()
  await expect(page.getByText('1 小时 30 分钟', { exact: true })).toBeVisible()
  await create(page, '打卡书桌', '仅标记使用', '')
  await page.getByRole('button', { name: '打卡书桌：标记已使用' }).click()
  await expect(page.getByText('1 条', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '打卡书桌：标记已使用' }).click()
  await expect(page.getByText('2 条', { exact: true })).toBeVisible()
  await expect(page.getByText('1 天', { exact: true }).first()).toBeVisible()
})
test('真实照片、ZIP 下载、独立浏览器恢复与离线操作', async ({ page, browser }) => {
  await page.goto('/#/items/new')
  await page.getByLabel('物品名称').fill('照片测试')
  await page
    .getByLabel('添加照片', { exact: true })
    .setInputFiles(resolve('public/icons/icon-192.png'))
  await expect(page.getByRole('button', { name: '删除照片 1' })).toBeVisible()
  await page.getByRole('button', { name: '保存物品' }).click()
  await expect(page.getByRole('img', { name: '照片测试', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '照片测试：+1' }).click()
  await expect(page.getByText('1 次', { exact: true })).toBeVisible()
  await page.goto('/#/settings/backup')
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: '下载完整 ZIP 备份' }).click()
  const download = await pending
  const path = await download.path()
  expect(path).toBeTruthy()
  await page.getByRole('button', { name: '已确认文件保存' }).click()
  const context = await browser.newContext()
  const restored = await context.newPage()
  await restored.goto('http://127.0.0.1:4173/#/settings/backup')
  await restored.getByLabel('选择 ZIP 备份文件', { exact: true }).setInputFiles(path!)
  await expect(restored.getByText('备份校验通过')).toBeVisible()
  await restored.getByRole('button', { name: '跳过安全备份', exact: true }).click()
  await restored.getByRole('button', { name: '我了解，跳过安全备份' }).click()
  await restored.getByRole('button', { name: '覆盖恢复此备份' }).click()
  await restored.getByRole('button', { name: '确认覆盖恢复' }).click()
  await expect(
    restored.getByRole('heading', { name: '照片测试', exact: true }).first()
  ).toBeVisible()
  await restored.goto('http://127.0.0.1:4173/#/items')
  await restored
    .getByRole('link')
    .filter({ has: restored.getByRole('heading', { name: '照片测试', exact: true }) })
    .click()
  await expect(restored.getByRole('img', { name: '照片测试', exact: true })).toBeVisible()
  await expect(restored.getByText('1 次', { exact: true })).toBeVisible()
  await restored.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect.poll(() => restored.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await restored.reload()
  await expect(restored.getByRole('img', { name: '照片测试', exact: true })).toBeVisible()
  await restored.getByRole('button', { name: '照片测试：+1' }).click()
  await expect(restored.getByText('2 次', { exact: true })).toBeVisible()
  await create(restored, '离线物品')
  await context.close()
})
test('页面适配、分类操作、统计图表与截图', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  mkdirSync('docs/screenshots', { recursive: true })
  await page.goto('/#/')
  await expect(page.getByRole('heading', { name: /让每一件拥有/ })).toBeVisible()
  await page.screenshot({
    path: `docs/screenshots/home-${testInfo.project.name}.png`,
    fullPage: true,
  })
  for (const route of [
    '/items',
    '/items/new',
    '/stats',
    '/categories',
    '/settings',
    '/settings/backup',
    '/recycle',
  ]) {
    await page.goto('/#' + route)
    await expect(page.locator('main h1').or(page.locator('main h3')).first()).toBeVisible()
    expect(
      await page.evaluate(() => document.body.scrollWidth <= document.documentElement.clientWidth)
    ).toBe(true)
  }
  await page.goto('/#/categories')
  await page.getByLabel('新增分类').fill('旅行装备')
  await page.getByRole('button', { name: '添加', exact: true }).click()
  await expect(page.getByText('旅行装备', { exact: true })).toBeVisible()
  await create(page, '图表验收')
  await page.getByRole('button', { name: '图表验收：+1' }).click()
  await expect(page.getByText('1 次', { exact: true })).toBeVisible()
  await page.goto('/#/stats')
  await expect(page.locator('canvas').first()).toBeVisible()
  await expect(page.getByText('图表验收', { exact: true })).toBeVisible()
  await page.screenshot({
    path: `docs/screenshots/stats-${testInfo.project.name}.png`,
    fullPage: true,
  })
  expect(errors).toEqual([])
})
test('照片数量限制与删除最后一条日志后的成本', async ({ page }) => {
  await page.goto('/#/items/new')
  await page.getByLabel('物品名称').fill('五张照片')
  await page.getByLabel('购买价格').fill('0')
  const file = resolve('public/icons/icon-192.png')
  await page.getByLabel('添加照片', { exact: true }).setInputFiles(Array(6).fill(file))
  await expect(page.getByText('每件物品最多 5 张照片', { exact: true })).toBeVisible()
  await page.getByLabel('添加照片', { exact: true }).setInputFiles(Array(5).fill(file))
  await expect(page.getByRole('button', { name: /删除照片 \d/ })).toHaveCount(5)
  await page.getByRole('button', { name: '保存物品' }).click()
  await expect(page.getByRole('img', { name: /照片 \d/ })).toHaveCount(5)
  await page.getByRole('button', { name: '五张照片：+1' }).click()
  await expect(page.getByText('¥0.00', { exact: true }).first()).toBeVisible()
  await page.getByRole('link', { name: '查看使用历史' }).click()
  await page.getByRole('button', { name: /删除 .* 的记录/ }).click()
  await page.getByRole('button', { name: '删除记录', exact: true }).click()
  await expect(page.getByText('第一条足迹，等你留下')).toBeVisible()
  await page.goto('/#/items')
  await page
    .getByRole('link')
    .filter({ has: page.getByRole('heading', { name: '五张照片', exact: true }) })
    .click()
  await expect(page.getByText('尚未产生使用记录')).toBeVisible()
})
