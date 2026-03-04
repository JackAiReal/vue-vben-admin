<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type {
  PermissionDef,
  PermissionGroup,
  RbacUser,
} from '#/api/maixu/rbac';

import { computed, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Checkbox,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import { appendOperationLog } from '#/api/maixu/operation-log';
import {
  deletePermissionGroup,
  deleteRbacUser,
  fetchDefaultRegisterGroupSetting,
  fetchPermissionDefs,
  fetchPermissionGroups,
  fetchRbacUsers,
  saveDefaultRegisterGroupSetting,
  savePermissionGroup,
  saveRbacUser,
} from '#/api/maixu/rbac';

const userStore = useUserStore();
const isSuper = computed(() =>
  (userStore.userInfo?.roles || []).includes('super'),
);

const loading = ref(false);
const permissionDefs = ref<PermissionDef[]>([]);
const groups = ref<PermissionGroup[]>([]);
const users = ref<RbacUser[]>([]);
const defaultRegisterGroupId = ref<number>(0);
const savingDefaultRegisterGroup = ref(false);

const groupModalOpen = ref(false);
const savingGroup = ref(false);
const editingGroup = ref<null | PermissionGroup>(null);
const groupForm = reactive({
  description: '',
  name: '',
  permissions: [] as string[],
});

const userModalOpen = ref(false);
const savingUser = ref(false);
const editingUser = ref<null | RbacUser>(null);
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
  { label: '超级管理员', value: 'super' },
  { label: '普通管理员', value: 'admin' },
  { label: '普通用户', value: 'user' },
];

const groupColumns: TableColumnsType<PermissionGroup> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '分组名称', dataIndex: 'name', key: 'name', width: 180 },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    width: 220,
    ellipsis: true,
  },
  { title: '权限数量', key: 'count', width: 110 },
  { title: '系统内置', key: 'readonly', width: 110 },
  { title: '操作', key: 'actions', width: 140, fixed: 'right' },
];

const userColumns: TableColumnsType<RbacUser> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '账号', dataIndex: 'username', key: 'username', width: 140 },
  {
    title: '邮箱',
    dataIndex: 'email',
    key: 'email',
    width: 220,
    ellipsis: true,
  },
  { title: '姓名', dataIndex: 'realName', key: 'realName', width: 140 },
  { title: '角色', key: 'role', width: 120 },
  { title: '用户组', dataIndex: 'groupName', key: 'groupName', width: 180 },
  { title: '状态', key: 'enabled', width: 100 },
  { title: '操作', key: 'actions', width: 140, fixed: 'right' },
];

const permissionSections = computed(() => {
  const categoryOrder: Record<string, number> = {
    左侧菜单: 10,
    按钮权限: 20,
    其他权限: 99,
  };

  const categoryMap = new Map<string, Map<string, PermissionDef[]>>();

  for (const item of permissionDefs.value) {
    const category = item.category || '其他权限';
    const menuGroup = item.menuGroup || '未分类';

    const groupMap = categoryMap.get(category) || new Map<string, PermissionDef[]>();
    const list = groupMap.get(menuGroup) || [];
    list.push(item);
    groupMap.set(menuGroup, list);
    categoryMap.set(category, groupMap);
  }

  return [...categoryMap.entries()]
    .sort((left, right) => {
      const leftOrder = categoryOrder[left[0]] ?? 100;
      const rightOrder = categoryOrder[right[0]] ?? 100;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left[0].localeCompare(right[0], 'zh-CN');
    })
    .map(([category, groupMap]) => {
      const groups = [...groupMap.entries()]
        .map(([name, items]) => ({
          items: [...items].toSorted((a, b) => {
            const leftOrder = Number(a.order || 0);
            const rightOrder = Number(b.order || 0);
            if (leftOrder !== rightOrder) {
              return leftOrder - rightOrder;
            }
            return a.label.localeCompare(b.label, 'zh-CN');
          }),
          name,
        }))
        .toSorted((a, b) => {
          const leftOrder = Number(a.items[0]?.order || 0);
          const rightOrder = Number(b.items[0]?.order || 0);
          if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
          }
          return a.name.localeCompare(b.name, 'zh-CN');
        });

      return { category, groups };
    });
});

const groupOptions = computed(() =>
  groups.value.map((item) => ({ label: item.name, value: item.id })),
);

function asGroup(record: Record<string, any>) {
  return record as PermissionGroup;
}

function asRbacUser(record: Record<string, any>) {
  return record as RbacUser;
}

async function loadData() {
  if (!isSuper.value) {
    return;
  }

  loading.value = true;
  try {
    const [defs, groupList, userList, defaultGroupSetting] = await Promise.all([
      fetchPermissionDefs(),
      fetchPermissionGroups(),
      fetchRbacUsers(),
      fetchDefaultRegisterGroupSetting(),
    ]);
    permissionDefs.value = defs;
    groups.value = groupList;
    users.value = userList;
    defaultRegisterGroupId.value = Number(defaultGroupSetting.groupId || 0);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载权限数据失败');
  } finally {
    loading.value = false;
  }
}

async function saveDefaultGroupSetting() {
  if (!defaultRegisterGroupId.value) {
    message.warning('请先选择默认注册权限组');
    return;
  }

  savingDefaultRegisterGroup.value = true;
  try {
    const result = await saveDefaultRegisterGroupSetting(defaultRegisterGroupId.value);
    defaultRegisterGroupId.value = Number(result.groupId || defaultRegisterGroupId.value);

    const groupName =
      groups.value.find((item) => item.id === defaultRegisterGroupId.value)?.name ||
      String(defaultRegisterGroupId.value);

    await appendOperationLog('系统配置/权限分组管理', '设置默认注册权限组', {
      defaultGroupId: defaultRegisterGroupId.value,
      defaultGroupName: groupName,
    });

    message.success('默认注册权限组已更新');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '设置默认权限组失败');
  } finally {
    savingDefaultRegisterGroup.value = false;
  }
}

function openCreateGroup() {
  editingGroup.value = null;
  groupForm.name = '';
  groupForm.description = '';
  groupForm.permissions = [];
  groupModalOpen.value = true;
}

function openEditGroup(record: PermissionGroup) {
  editingGroup.value = record;
  groupForm.name = record.name;
  groupForm.description = record.description || '';
  groupForm.permissions = [...record.permissions];
  groupModalOpen.value = true;
}

async function submitGroup() {
  if (!groupForm.name.trim()) {
    message.warning('分组名称不能为空');
    return;
  }

  savingGroup.value = true;
  try {
    await savePermissionGroup({
      description: groupForm.description,
      id: editingGroup.value?.id,
      name: groupForm.name.trim(),
      permissions: groupForm.permissions,
    });
    groupModalOpen.value = false;
    await appendOperationLog(
      '系统配置/权限分组管理',
      editingGroup.value ? '修改权限组' : '新增权限组',
      { name: groupForm.name, permissions: groupForm.permissions },
    );
    message.success('分组保存成功');
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '分组保存失败');
  } finally {
    savingGroup.value = false;
  }
}

async function removeGroup(record: PermissionGroup) {
  try {
    await deletePermissionGroup(record.id);
    await appendOperationLog('系统配置/权限分组管理', '删除权限组', {
      id: record.id,
      name: record.name,
    });
    message.success('分组删除成功');
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '分组删除失败');
  }
}

function openCreateUser() {
  editingUser.value = null;
  userForm.username = '';
  userForm.email = '';
  userForm.realName = '';
  userForm.password = '';
  userForm.groupId = groupOptions.value[0]?.value || 0;
  userForm.role = 'admin';
  userForm.enabled = true;
  userModalOpen.value = true;
}

function openEditUser(record: RbacUser) {
  editingUser.value = record;
  userForm.username = record.username;
  userForm.email = record.email || '';
  userForm.realName = record.realName;
  userForm.password = '';
  userForm.groupId = record.groupId;
  userForm.role = (record.roles?.[0] || 'admin') as 'admin' | 'super' | 'user';
  userForm.enabled = record.enabled;
  userModalOpen.value = true;
}

async function submitUser() {
  if (!userForm.username.trim() || !userForm.realName.trim()) {
    message.warning('账号和姓名不能为空');
    return;
  }
  if (!userForm.email.trim()) {
    message.warning('邮箱不能为空');
    return;
  }
  if (!editingUser.value && !userForm.password.trim()) {
    message.warning('新建用户必须设置密码');
    return;
  }
  if (!userForm.groupId) {
    message.warning('请选择用户组');
    return;
  }

  savingUser.value = true;
  try {
    await saveRbacUser({
      email: userForm.email.trim(),
      enabled: userForm.enabled,
      groupId: userForm.groupId,
      id: editingUser.value?.id,
      password: userForm.password || undefined,
      realName: userForm.realName.trim(),
      role: userForm.role,
      username: userForm.username.trim(),
    });
    userModalOpen.value = false;
    await appendOperationLog(
      '系统配置/权限分组管理',
      editingUser.value ? '修改账号' : '新增账号',
      {
        username: userForm.username,
        role: userForm.role,
        groupId: userForm.groupId,
      },
    );
    message.success('用户保存成功');
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '用户保存失败');
  } finally {
    savingUser.value = false;
  }
}

async function removeUser(record: RbacUser) {
  try {
    await deleteRbacUser(record.id);
    await appendOperationLog('系统配置/权限分组管理', '删除账号', {
      id: record.id,
      username: record.username,
    });
    message.success('用户删除成功');
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '用户删除失败');
  }
}

loadData();
</script>

<template>
  <Page
    title="权限分组管理"
    description="超级管理员可维护权限组，并将管理员/普通用户分配到对应用户组。"
  >
    <Card v-if="!isSuper">
      当前账号不是超级管理员，仅可查看业务页面，无法进入权限管理。
    </Card>

    <template v-else>
      <Card class="mb-4" title="权限组管理">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Button type="primary" @click="openCreateGroup">新增权限组</Button>
          <Space>
            <span class="text-sm text-gray-500">默认注册权限组</span>
            <Select
              v-model:value="defaultRegisterGroupId"
              :options="groupOptions"
              style="min-width: 220px"
              placeholder="选择默认权限组"
            />
            <Button
              type="primary"
              :loading="savingDefaultRegisterGroup"
              @click="saveDefaultGroupSetting"
            >
              保存默认组
            </Button>
          </Space>
        </div>
        <Table
          :columns="groupColumns"
          :data-source="groups"
          :loading="loading"
          :pagination="false"
          row-key="id"
          :scroll="{ x: 900 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'count'">
              {{ (asGroup(record).permissions || []).length }}
            </template>
            <template v-else-if="column.key === 'readonly'">
              <Tag :color="asGroup(record).readonly ? 'gold' : 'blue'">
                {{ asGroup(record).readonly ? '是' : '否' }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <Space>
                <Button
                  size="small"
                  type="link"
                  :disabled="
                    asGroup(record).readonly &&
                    asGroup(record).name !== '查看权限组'
                  "
                  @click="openEditGroup(asGroup(record))"
                >
                  修改
                </Button>
                <Popconfirm
                  title="确认删除该分组吗？"
                  @confirm="removeGroup(asGroup(record))"
                >
                  <Button
                    size="small"
                    type="link"
                    danger
                    :disabled="asGroup(record).readonly"
                  >
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            </template>
          </template>
        </Table>
      </Card>

      <Card title="账号管理">
        <div class="mb-3">
          <Button type="primary" @click="openCreateUser">新增账号</Button>
        </div>
        <Table
          :columns="userColumns"
          :data-source="users"
          :loading="loading"
          :pagination="false"
          row-key="id"
          :scroll="{ x: 980 }"
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
                  @click="openEditUser(asRbacUser(record))"
                >
                  修改
                </Button>
                <Popconfirm
                  title="确认删除该账号吗？"
                  @confirm="removeUser(asRbacUser(record))"
                >
                  <Button
                    size="small"
                    type="link"
                    danger
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
    </template>

    <Modal
      v-model:open="groupModalOpen"
      :confirm-loading="savingGroup"
      :title="editingGroup ? '修改权限组' : '新增权限组'"
      width="980px"
      wrap-class-name="rbac-group-modal"
      @ok="submitGroup"
    >
      <div class="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input v-model:value="groupForm.name" placeholder="分组名称" />
        <Input v-model:value="groupForm.description" placeholder="分组描述" />
      </div>
      <Checkbox.Group v-model:value="groupForm.permissions">
        <div
          v-for="section in permissionSections"
          :key="section.category"
          class="permission-panel mb-4 rounded-md p-3"
        >
          <div class="mb-3 text-sm font-semibold">{{ section.category }}</div>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div
              v-for="group in section.groups"
              :key="`${section.category}-${group.name}`"
              class="permission-group rounded-md p-2"
            >
              <div class="permission-group-title mb-2 text-xs font-medium">
                {{ group.name }}
              </div>
              <div class="grid grid-cols-1 gap-1">
                <Checkbox
                  v-for="perm in group.items"
                  :key="perm.code"
                  :value="perm.code"
                  class="permission-checkbox"
                >
                  {{ perm.label }}
                </Checkbox>
              </div>
            </div>
          </div>
        </div>
      </Checkbox.Group>
    </Modal>

    <Modal
      v-model:open="userModalOpen"
      :confirm-loading="savingUser"
      :title="editingUser ? '修改账号' : '新增账号'"
      width="640px"
      @ok="submitUser"
    >
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input
          v-model:value="userForm.username"
          placeholder="账号"
          :disabled="!!editingUser"
        />
        <Input v-model:value="userForm.email" placeholder="邮箱" />
        <Input v-model:value="userForm.realName" placeholder="姓名" />
        <Input
          v-model:value="userForm.password"
          :placeholder="editingUser ? '密码(留空不修改)' : '密码'"
        />
        <Select
          v-model:value="userForm.role"
          :options="roleOptions"
          placeholder="角色"
        />
        <Select
          v-model:value="userForm.groupId"
          :options="groupOptions"
          placeholder="用户组"
        />
        <Checkbox v-model:checked="userForm.enabled" class="pt-2">
          启用账号
        </Checkbox>
      </div>
    </Modal>
  </Page>
</template>

<style>
.rbac-group-modal .ant-modal-content,
.rbac-group-modal .ant-modal-header,
.rbac-group-modal .ant-modal-body {
  background: #1f232c;
  color: #e5e7eb;
}

.rbac-group-modal .ant-modal-title,
.rbac-group-modal .ant-modal-close-x {
  color: #f3f4f6;
}

.rbac-group-modal .ant-modal-header {
  border-bottom: 1px solid #303744;
}

.rbac-group-modal .permission-panel {
  background: #232936;
  border: 1px solid #3a4455;
}

.rbac-group-modal .permission-group {
  background: #1b2330;
  border: 1px solid #324155;
}

.rbac-group-modal .permission-group-title {
  color: #93c5fd;
}

.rbac-group-modal .permission-checkbox {
  display: flex;
  align-items: flex-start;
  width: 100%;
  min-height: 22px;
  margin-inline-end: 0;
  white-space: normal;
  line-height: 1.45;
}

.rbac-group-modal .permission-checkbox .ant-checkbox {
  margin-top: 2px;
}

.rbac-group-modal .permission-checkbox .ant-checkbox + span,
.rbac-group-modal .permission-checkbox.ant-checkbox-wrapper > span:last-child {
  display: inline-block;
  color: #e5e7eb !important;
  white-space: normal;
  word-break: break-word;
}

.rbac-group-modal .permission-checkbox.ant-checkbox-wrapper-disabled .ant-checkbox + span,
.rbac-group-modal .permission-checkbox.ant-checkbox-wrapper-disabled > span:last-child {
  color: #9ca3af !important;
}
</style>
