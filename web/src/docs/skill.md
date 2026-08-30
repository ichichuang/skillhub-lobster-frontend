---
name: skillhub-registry
description: 当你需要在技能注册中心搜索、查看、安装或发布智能体技能时使用本指南。该注册中心提供兼容 ClawHub 的 API，因此应优先使用 `clawhub` CLI 执行注册中心操作，而不是直接发起原始 HTTP 请求。
---

# 技能注册中心指南

当你需要使用技能注册中心搜索技能、查看元数据、安装技能包或发布新版本时，请遵循本指南。

> 重要：优先使用 `clawhub` CLI 执行注册中心操作。注册中心提供兼容 ClawHub 的 API 和 `/.well-known/clawhub.json` 发现端点；仅在排查服务器问题时才直接使用原始 HTTP 请求。

## 注册中心说明

这是面向企业的技能注册中心，用于存储带版本的技能包，支持基于命名空间的技能管理，并兼容 OpenClaw 与 OpenSkills 风格的 `SKILL.md` 技能包。

要点：

- 内部坐标格式为 `@{namespace}/{skill_slug}`。
- 使用 clawhub CLI 时，兼容格式为 `{namespace}--{skill_slug}`。
- 兼容 ClawHub 的客户端使用 `{namespace}--{skill_slug}` 标识。
- `latest` 始终表示最新已发布版本，不表示草稿或待审核版本。
- `@global` 中的公开技能可匿名下载。
- 未指定命名空间时，默认使用 `@global`。
- 可使用 `{skill_slug}` 代替 `global--{skill_slug}`。
- 团队命名空间技能和非公开技能需要认证。

## 配置 CLI

将 `clawhub` 指向注册中心基址：

```bash
export CLAWHUB_REGISTRY=https://registry.your-company.com
```

也可以每次显式使用 `--registry` 参数，例如：

```bash
npx clawhub install my-skill --registry https://registry.your-company.com
```

如需认证访问，请提供 API 令牌：

```bash
clawhub login --token sk_your_api_token_here
```

可选的本地检查：

```bash
curl https://registry.your-company.com/.well-known/clawhub.json
```

预期 HTTP 响应：

```json
{"apiBase":"/api/v1"}
```

## 坐标规则

注册中心有两种命名形式：

| 注册中心坐标 | `clawhub` 的规范标识 |
|---|---|
| `@global/my-skill` | `my-skill` |
| `@team-name/my-skill` | `team-name--my-skill` |

规则：

- `--` 是兼容层中的命名空间分隔符。
- 没有 `--` 时，技能会被视为 `@global/...`。
- `latest` 仅解析为最新已发布版本。

示例：

```bash
npx clawhub install my-skill
npx clawhub install my-skill@1.2.0
npx clawhub install team-name--my-skill
```

## 常用操作

### 搜索

```bash
npx clawhub search email
```

需要查看较广泛的列表时，使用空查询：

```bash
npx clawhub search ""
```

### 查看技能

```bash
npx clawhub info my-skill
npx clawhub info team-name--my-skill
```

### 安装

```bash
npx clawhub install my-skill
npx clawhub install my-skill@1.2.0
npx clawhub install team-name--my-skill
```

### 发布

准备技能包目录后发布：

```bash
npx clawhub publish ./my-skill
```

发布需要认证，以及目标命名空间中的足够权限。

## 认证与可见性

下载和搜索权限取决于命名空间与可见性：

- `@global` + `PUBLIC`：允许匿名搜索、查看和下载。
- 团队命名空间 + `PUBLIC`：下载需要认证。
- `NAMESPACE_ONLY`：仅限已认证的命名空间成员。
- `PRIVATE`：仅限所有者或被明确授权的用户。
- 发布、收藏及其他写操作始终需要认证。

如果 HTTP 请求返回 `403`，请检查：

- 技能是否属于团队命名空间；
- 是否为 `NAMESPACE_ONLY` 或 `PRIVATE`；
- API 令牌是否有效；
- 是否拥有命名空间发布权限。

## 技能包协议

技能包使用 OpenSkills 风格的规范 `SKILL.md` 作为入口文件。上传会接受如 `skill.md` 这类文件名大小写变体，并将其规范化为 `SKILL.md`。

## 发布说明

请遵循 OpenSkills 风格的技能包规范。
