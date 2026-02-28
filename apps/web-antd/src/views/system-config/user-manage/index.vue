<script lang="ts" setup>
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type { PermissionGroup, RbacUser } from '#/api/maixu/rbac';

import { computed, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import { appendOperationLog } from '#/api/maixu/operation-log';
import {
  listPermissionGroupsForUsers,
  querySystemUsers,
  removeSystemUser,
  saveSystemUser,
  setSystemUserEnabled,
} from '#/api/maixu/user-manage';

const userStore = useUserStore();
const isSuper = computed(() =>
  (userStore.userInfo?.roles || []).includes('super'),
);

const loading = ref(false);
const groups = ref<PermissionGroup[]>([]);
const rows = ref<RbacUser[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const queryForm = reactive({
  enabled: '' as '' | 'false' | 'true',
  groupId: undefined as number | undefined,
  keyword: '',
  role: '' as '' | 'admin' | 'super' | 'user',
});

const modalOpen = ref(false);
const saving = ref(false);
const editing = ref<null | RbacUser>(null);
const userForm = reactive({
  email: '',
  enabled: true,
  groupId: 0,
  password: '',
  realName: '',
  role: 'admin' as 'admin' | 'super' | 'user',
  username: '',
});

const roleOptions = [
  { label: '全部角色', value: '' },
  { label: '超级管理员', value: 'super' },
  { label: '普通管理员', value: 'admin' },
  { label: '普通用户', value: 'user' },
];

const enabledOptions = [
  { label: '全部状态', value: '' },
  { label: '启用', value: 'true' },
  { label: '禁用', value: 'false' },
];

const columns: TableColumnsType<RbacUser> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '账号', dataIndex: 'username', key: 'username', width: 150 },
  {
    title: '邮箱',
    dataIndex: 'email',
    key: 'email',
    width: 240,
    ellipsis: true,
  },
  { title: '姓名', dataIndex: 'realName', key: 'realName', width: 140 },
  { title: '角色', key: 'role', width: 120 },
  { title: '权限组', dataIndex: 'groupName', key: 'groupName', width: 180 },
  { title: '状态', key: 'enabled', width: 110 },
  { title: '操作', key: 'actions', width: 240, fixed: 'right' },
];

const groupOptions = computed(() => [
  { label: '全部分组', value: undefined },
  ...groups.value.map((item) => ({ label: item.name, value: item.id })),
]);

const createEditGroupOptions = computed(() =>
  groups.value.map((item) => ({ label: item.name, value: item.id })),
);

const pagination = computed<TablePaginationConfig>(() => ({
  current: page.value,
  pageSize: pageSize.value,
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (count) => `共 ${count} 条`,
  total: total.value,
}));

function asRbacUser(record: Record<string, any>) {
  return record as RbacUser;
}

async function loadGroups() {
  if (!isSuper.value) {
    return;
  }
  groups.value = await listPermissionGroupsForUsers();
}

async function loadUsers() {
  if (!isSuper.value) {
    return;
  }

  loading.value = true;
  try {
    const result = await querySystemUsers({
      enabled: queryForm.enabled,
      groupId: queryForm.groupId,
      keyword: queryForm.keyword.trim(),
      page: page.value,
      pageSize: pageSize.value,
      role: queryForm.role,
    });

    rows.value = result.list;
    page.value = result.page;
    pageSize.value = result.pageSize;
    total.value = result.total;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载用户失败');
  } finally {
    loading.value = false;
  }
}

async function reload() {
  await Promise.all([loadGroups(), loadUsers()]);
}

function handleSearch() {
  page.value = 1;
  loadUsers();
}

function resetQuery() {
  queryForm.enabled = '';
  queryForm.groupId = undefined;
  queryForm.keyword = '';
  queryForm.role = '';
  page.value = 1;
  loadUsers();
}

function openCreateModal() {
  editing.value = null;
  userForm.username = '';
  userForm.email = '';
  userForm.realName = '';
  userForm.password = '';
  userForm.groupId = createEditGroupOptions.value[0]?.value || 0;
  userForm.role = 'admin';
  userForm.enabled = true;
  modalOpen.value = true;
}

function openEditModal(record: RbacUser) {
  editing.value = record;
  userForm.username = record.username;
  userForm.email = record.email || '';
  userForm.realName = record.realName;
  userForm.password = '';
  userForm.groupId = record.groupId;
  userForm.role = (record.roles?.[0] || 'admin') as 'admin' | 'super' | 'user';
  userForm.enabled = record.enabled;
  modalOpen.value = true;
}

async function submitUser() {
  if (!userForm.username.trim()) {
    message.warning('账号不能为空');
    return;
  }
  if (!userForm.email.trim()) {
    message.warning('邮箱不能为空');
    return;
  }
  if (!userForm.realName.trim()) {
    message.warning('姓名不能为空');
    return;
  }
  if (!editing.value && !userForm.password.trim()) {
    message.warning('新建用户必须输入密码');
    return;
  }
  if (!userForm.groupId) {
    message.warning('请选择权限组');
    return;
  }

  saving.value = true;
  try {
    await saveSystemUser({
      email: userForm.email.trim(),
      enabled: userForm.enabled,
      groupId: userForm.groupId,
      id: editing.value?.id,
      password: userForm.password || undefined,
      realName: userForm.realName.trim(),
      role: userForm.role,
      username: userForm.username.trim(),
    });

    await appendOperationLog(
      '系统配置/用户管理',
      editing.value ? '修改用户' : '新增用户',
      {
        email: userForm.email,
        groupId: userForm.groupId,
        role: userForm.role,
        username: userForm.username,
      },
    );

    modalOpen.value = false;
    message.success('用户保存成功');
    await loadUsers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '用户保存失败');
  } finally {
    saving.value = false;
  }
}

async function removeUser(record: RbacUser) {
  try {
    await removeSystemUser(record.id);
    await appendOperationLog('系统配置/用户管理', '删除用户', {
      id: record.id,
      username: record.username,
    });
    message.success('删除成功');
    await loadUsers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败');
  }
}

async function toggleUserEnabled(record: RbacUser, enabled: boolean) {
  try {
    await setSystemUserEnabled(record.id, enabled);
    await appendOperationLog(
      '系统配置/用户管理',
      enabled ? '恢复用户' : '禁用用户',
      {
        id: record.id,
        username: record.username,
      },
    );
    message.success(enabled ? '已恢复用户' : '已禁用用户');
    await loadUsers();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '操作失败');
  }
}

function handleTableChange(payload: TablePaginationConfig) {
  page.value = Number(payload.current || 1);
  pageSize.value = Number(payload.pageSize || 20);
  loadUsers();
}

reload();
</script>

<template>
  <Page
    title="用户管理"
    description="仅超级管理员可访问，支持用户筛选、分页、新增、编辑、禁用/恢复。"
  >
    <Card v-if="!isSuper">
      当前账号不是超级管理员，无法访问用户管理页面。
    </Card>

    <template v-else>
      <Card class="mb-4" title="筛选条件">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input
            v-model:value="queryForm.keyword"
            allow-clear
            placeholder="账号/邮箱/姓名"
          />
          <Select
            v-model:value="queryForm.role"
            :options="roleOptions"
            placeholder="角色"
          />
          <Select
            v-model:value="queryForm.enabled"
            :options="enabledOptions"
            placeholder="状态"
          />
          <Select
            v-model:value="queryForm.groupId"
            :options="groupOptions"
            placeholder="权限组"
          />
        </div>

        <Space class="mt-3">
          <Button type="primary" @click="handleSearch">查询</Button>
          <Button @click="resetQuery">重置</Button>
          <Button type="primary" @click="openCreateModal">新增用户</Button>
        </Space>
      </Card>

      <Card>
        <Table
          :columns="columns"
          :data-source="rows"
          :loading="loading"
          :pagination="pagination"
          :scroll="{ x: 1260 }"
          row-key="id"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'role'">
              <Tag color="purple">
                {{ asRbacUser(record).roles?.[0] || '-' }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'enabled'">
              <Tag :color="asRbacUser(record).enabled ? 'green' : 'red'">
                {{ asRbacUser(record).enabled ? '启用' : '禁用' }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <Space>
                <Button
                  size="small"
                  type="link"
                  @click="openEditModal(asRbacUser(record))"
                >
                  编辑
                </Button>
                <Popconfirm
                  :title="
                    asRbacUser(record).enabled
                      ? '确认禁用该用户吗？'
                      : '确认恢复该用户吗？'
                  "
                  @confirm="
                    toggleUserEnabled(
                      asRbacUser(record),
                      !asRbacUser(record).enabled,
                    )
                  "
                >
                  <Button
                    size="small"
                    type="link"
                    :danger="asRbacUser(record).enabled"
                  >
                    {{ asRbacUser(record).enabled ? '禁用' : '恢复' }}
                  </Button>
                </Popconfirm>
                <Popconfirm
                  title="确认删除该用户吗？"
                  @confirm="removeUser(asRbacUser(record))"
                >
                  <Button
                    danger
                    size="small"
                    type="link"
                    :disabled="asRbacUser(record).roles?.includes('super')"
                  >
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            </template>
          </template>
        </Table>
      </Card>

      <Modal
        v-model:open="modalOpen"
        :confirm-loading="saving"
        :title="editing ? '编辑用户' : '新增用户'"
        width="680px"
        @ok="submitUser"
      >
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            v-model:value="userForm.username"
            placeholder="账号"
            :disabled="!!editing"
          />
          <Input v-model:value="userForm.email" placeholder="邮箱" />
          <Input v-model:value="userForm.realName" placeholder="姓名" />
          <Input
            v-model:value="userForm.password"
            :placeholder="editing ? '密码(留空不修改)' : '密码'"
          />
          <Select
            v-model:value="userForm.groupId"
            :options="createEditGroupOptions"
            placeholder="权限组"
          />
          <Select
            v-model:value="userForm.role"
            :options="roleOptions.filter((item) => item.value !== '')"
            placeholder="角色"
          />
        </div>
        <div class="mt-3 flex items-center gap-2">
          <span class="text-sm text-gray-500">状态</span>
          <Switch v-model:checked="userForm.enabled" />
          <span class="text-xs text-gray-500">{{
            userForm.enabled ? '启用' : '禁用'
          }}</span>
        </div>
      </Modal>
    </template>
  </Page>
</template>
