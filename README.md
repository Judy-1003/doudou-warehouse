# 豆豆小仓库

原生微信小程序 TypeScript 工程，用于记录咖啡豆库存、饮品辅料和每日咖啡。

## 导入微信开发者工具

1. 打开微信开发者工具，选择“导入项目”。
2. 项目目录选择本文件所在目录 `doudou-warehouse`，不要只选择 `miniprogram` 子目录。
3. 在导入窗口填写你的小程序 AppID；也可以导入后在“详情 → 基本信息”中替换测试 AppID。
4. 首次编译后，先登记一包咖啡豆，并按需在饮品架添加牛奶或椰子水。
5. 在开发者工具的“隐私保护指引”中声明相机和相册用途后，再测试咖啡照片上传。

当前 `project.config.json` 使用 `touristappid`，用于无正式 AppID 时本地预览。上传前必须替换为在微信公众平台申请的小程序 AppID。

## 数据说明

- 第一版使用微信本地缓存，不需要配置服务器或云开发环境。
- 咖啡记录、库存、设置都保存在当前微信用户当前设备内；清理小程序数据或换设备后不会自动同步。
- 咖啡照片通过 `wx.chooseMedia` 选择，并用 `wx.saveFile` 保存在本机小程序沙盒内。
- 以后需要跨设备同步时，可将 `miniprogram/services/storage.ts` 替换为微信云开发数据层，页面和业务模型无需重写。

## 上传前检查

- 将项目 AppID 替换为正式 AppID。
- 在微信公众平台完成名称、类目、头像和隐私保护指引配置。
- 用真机测试：登记豆子、添加饮品、记一杯、上传照片、启封/喝完及撤销、统计。
- 在开发者工具中执行“代码质量”检查，确认没有编译错误后再点击“上传”。

## 工程结构

- `miniprogram/pages/home`：记一杯、今日记录、咖啡日历
- `miniprogram/pages/warehouse`：豆仓与饮品架
- `miniprogram/pages/bean-form`、`drink-form`：录入页
- `miniprogram/pages/settings`：个人设置入口
- `miniprogram/pages/defaults`、`bean-list`、`bean-detail`、`statistics`：设置子页
- `miniprogram/models`：TypeScript 数据模型
- `miniprogram/services/storage.ts`：本地持久化
- `miniprogram/utils/calculations.ts`：成本、营养、日期与统计规则
