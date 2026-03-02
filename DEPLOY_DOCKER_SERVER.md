# Vue Vben Admin（Maixu）Docker 生产部署手册

目标：一套三容器部署，结构简单稳定。
- `frontend`：前端 Nginx（对外提供页面）
- `backend`：后端服务（提供 `/api`）
- `mysql`：MySQL 8（独立数据容器）

---

## 1. 架构说明

- 浏览器访问 `http://<server-ip>:${FRONTEND_PORT}`
- 前端将 `/api/*` 转发到 `backend:5320`
- 后端通过 `GINGER_API_BASE_URL` 转发业务请求到你的业务后端
- MySQL 独立容器，端口映射为 `${MYSQL_PORT_HOST}`

> 说明：当前仓库内后端 RBAC/日志默认本地持久化为 SQLite（`RBAC_DB_FILE`），MySQL 已集成并暴露参数，便于统一生产环境数据库管理。

---

## 2. 服务器准备

```bash
docker --version
docker compose version
```

如果没安装，请先安装 Docker 与 Docker Compose（插件模式）。

---

## 3. 拉代码

```bash
git clone <你的仓库地址> vue-vben-admin
cd vue-vben-admin
```

---

## 4. 生成配置

```bash
cp .env.docker.example .env
vi .env
```

---

## 5. 必改参数（生产必须）

在 `.env` 中至少修改这些：

```bash
# 业务后端地址（不要带 /v1/test）
GINGER_API_BASE_URL=http://你的业务后端IP:端口

# JWT/签名密钥（必须强随机）
ACCESS_TOKEN_SECRET=你的强随机字符串
REFRESH_TOKEN_SECRET=你的强随机字符串
MX_SIGN_SALT=你的强随机字符串

# MySQL root/app 密码
MYSQL_ROOT_PASSWORD=你的root密码
MYSQL_PASSWORD=你的app密码
```

推荐同时确认：

```bash
FRONTEND_PORT=5666
MYSQL_PORT_HOST=23306   # 若冲突改成其他端口
MYSQL_DATABASE=vben_prod
MYSQL_USERNAME=vben
```

---

## 6. MySQL 配置说明

### 内置 MySQL 容器
默认已启用，无需额外安装。

### 外部连接信息

- Host: `服务器IP`
- Port: `${MYSQL_PORT_HOST}`（默认建议 23306）
- DB: `${MYSQL_DATABASE}`
- User: `${MYSQL_USERNAME}`
- Password: `${MYSQL_PASSWORD}`

### 后端 MySQL 环境变量（已暴露）

- `MYSQL_URL`
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_DATABASE`
- `MYSQL_USERNAME`
- `MYSQL_PASSWORD`
- `MYSQL_SSL`
- `MYSQL_CHARSET`

可用 DSN 一把梭：

```bash
MYSQL_URL=mysql://vben:your_password@mysql:3306/vben_prod?charset=utf8mb4
```

---

## 7. 启动

```bash
docker compose up -d --build
```

查看状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f mysql
docker compose logs -f backend
docker compose logs -f frontend
```

---

## 8. 验证

```bash
# 前端首页
curl -I http://127.0.0.1:${FRONTEND_PORT}

# 前端 -> backend 代理链路
curl -i http://127.0.0.1:${FRONTEND_PORT}/api/test
```

MySQL 连通（示例）：

```bash
docker exec -it vue-vben-admin-mysql-1 \
  mysql -u${MYSQL_USERNAME} -p${MYSQL_PASSWORD} -e "SELECT 1;"
```

---

## 9. 日常运维

```bash
# 停止
docker compose stop

# 启动
docker compose start

# 重启
docker compose restart

# 更新后重建
docker compose up -d --build

# 下线（保留数据卷）
docker compose down

# 下线并删数据卷（危险）
docker compose down -v
```

---

## 10. 常见问题

### 10.1 端口冲突

错误示例：`Bind for 0.0.0.0:13306 failed: port is already allocated`

处理：修改 `.env`：

```bash
MYSQL_PORT_HOST=23306
```

然后重启：

```bash
docker compose up -d
```

### 10.2 修改 `.env` 后不生效

```bash
docker compose up -d --build
```

### 10.3 镜像拉取慢

本项目 Dockerfile 已切到更友好的镜像前缀（`docker.1ms.run`）。

---

## 11. 极简上线命令

```bash
git clone <repo> vue-vben-admin
cd vue-vben-admin
cp .env.docker.example .env
vi .env  # 改 GINGER_API_BASE_URL + 3个密钥 + MySQL密码
docker compose up -d --build
docker compose ps
```
