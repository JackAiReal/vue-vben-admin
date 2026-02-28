<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import { computed, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Button,
  Card,
  Checkbox,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  message,
} from 'ant-design-vue';

import {
  deletePermissionGroup,
  deleteRbacUser,
  fetchPermissionDefs,
  fetchPermissionGroups,
  fetchRbacUsers,
  savePermissionGroup,
  saveRbacUser,
  type PermissionDef,
  type PermissionGroup,
  type RbacUser,
} from '#/api/maixu/rbac';

const userStore = useUserStore();
const isSuper = computed(() => (userStore.userInfo?.roles || []).includes('super'));

const loading = ref(false);
const permissionDefs = ref<PermissionDef[]>([]);
const groups = ref<PermissionGroup[]>([]);
const users = ref<RbacUser[]>([]);

const groupModalOpen = ref(false);
const savingGroup = ref(false);
const editingGroup = ref<PermissionGroup | null>(null);
const groupForm = reactive({
  description: '',
  name: '',
  permissions: [] as string[],
});

const userModalOpen = ref(false);
const savingUser = ref(false);
const editingUser = ref<RbacUser | null>(null);
const userForm = reactive({
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
  { title: '描述', dataIndex: 'description', key: 'description', width: 220, ellipsis: true },
  { title: '权限数量', key: 'count', width: 110 },
  { title: '系统内置', key: 'readonly', width: 110 },
  { title: '操作', key: 'actions', width: 140, fixed: 'right' },
];

const userColumns: TableColumnsType<RbacUser> = [
  { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
  { title: '账号', dataIndex: 'username', key: 'username', width: 140 },
  { title: '姓名', dataIndex: 'realName', key: 'realName', width: 140 },
  { title: '角色', key: 'role', width: 120 },
  { title: '用户组', dataIndex: 'groupName', key: 'groupName', width: 180 },
  { title: '状态', key: 'enabled', width: 100 },
  { title: '操作', key: 'actions', width: 140, fixed: 'right' },
];

const groupedPermissionDefs = computed(() => {
  const map = new Map<string, PermissionDef[]>();
  for (const item of permissionDefs.value) {
    const list = map.get(item.category) || [];
    list.push(item);
    map.set(item.category, list);
  }
  return Array.from(map.entries());
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
    const [defs, groupList, userList] = await Promise.all([
      fetchPermissionDefs(),
      fetchPermissionGroups(),
      fetchRbacUsers(),
    ]);
    permissionDefs.value = defs;
    groups.value = groupList;
    users.value = userList;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载权限数据失败');
  } finally {
    loading.value = false;
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
    message.success('分组删除成功');
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '分组删除失败');
  }
}

function openCreateUser() {
  editingUser.value = null;
  userForm.username = '';
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
      enabled: userForm.enabled,
      groupId: userForm.groupId,
      id: editingUser.value?.id,
      password: userForm.password || undefined,
      realName: userForm.realName.trim(),
      role: userForm.role,
      username: userForm.username.trim(),
    });
    userModalOpen.value = false;
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
    message.success('用户删除成功');
    await loadData();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '用户删除失败');
  }
}

loadData();
</script>

<template>
  <Page title="权限分组管理" description="超级管理员可维护权限组，并将管理员/普通用户分配到对应用户组。">
    <Card v-if="!isSuper">
      当前账号不是超级管理员，仅可查看业务页面，无法进入权限管理。
    </Card>

    <template v-else>
      <Card class="mb-4" title="权限组管理">
        <div class="mb-3">
          <Button type="primary" @click="openCreateGroup">新增权限组</Button>
        </div>
        <Table :columns="groupColumns" :data-source="groups" :loading="loading" :pagination="false" row-key="id" :scroll="{ x: 900 }">
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
                <Button size="small" type="link" :disabled="asGroup(record).readonly" @click="openEditGroup(asGroup(record))">修改</Button>
                <Popconfirm title="确认删除该分组吗？" @confirm="removeGroup(asGroup(record))">
                  <Button size="small" type="link" danger :disabled="asGroup(record).readonly">删除</Button>
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
        <Table :columns="userColumns" :data-source="users" :loading="loading" :pagination="false" row-key="id" :scroll="{ x: 980 }">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'role'">
              <Tag color="purple">{{ asRbacUser(record).roles?.[0] || '-' }}</Tag>
            </template>
            <template v-else-if="column.key === 'enabled'">
              <Tag :color="asRbacUser(record).enabled ? 'green' : 'red'">
                {{ asRbacUser(record).enabled ? '启用' : '禁用' }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <Space>
                <Button size="small" type="link" @click="openEditUser(asRbacUser(record))">修改</Button>
                <Popconfirm title="确认删除该账号吗？" @confirm="removeUser(asRbacUser(record))">
                  <Button size="small" type="link" danger :disabled="asRbacUser(record).roles?.includes('super')">删除</Button>
                </Popconfirm>
              </Space>
            </template>
          </template>
        </Table>
      </Card>
    </template>

    <Modal v-model:open="groupModalOpen" :confirm-loading="savingGroup" :title="editingGroup ? '修改权限组' : '新增权限组'" width="760px" @ok="submitGroup">
      <div class="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input v-model:value="groupForm.name" placeholder="分组名称" />
        <Input v-model:value="groupForm.description" placeholder="分组描述" />
      </div>
      <div v-for="[category, perms] in groupedPermissionDefs" :key="category" class="mb-3">
        <div class="mb-1 font-medium">{{ category }}</div>
        <Checkbox.Group v-model:value="groupForm.permissions">
          <div class="grid grid-cols-1 gap-1 md:grid-cols-2">
            <Checkbox v-for="perm in perms" :key="perm.code" :value="perm.code">
              {{ perm.label }}
            </Checkbox>
          </div>
        </Checkbox.Group>
      </div>
    </Modal>

    <Modal v-model:open="userModalOpen" :confirm-loading="savingUser" :title="editingUser ? '修改账号' : '新增账号'" width="640px" @ok="submitUser">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input v-model:value="userForm.username" placeholder="账号" :disabled="!!editingUser" />
        <Input v-model:value="userForm.realName" placeholder="姓名" />
        <Input v-model:value="userForm.password" :placeholder="editingUser ? '密码(留空不修改)' : '密码'" />
        <Select v-model:value="userForm.role" :options="roleOptions" placeholder="角色" />
        <Select v-model:value="userForm.groupId" :options="groupOptions" placeholder="用户组" />
        <Checkbox v-model:checked="userForm.enabled" class="pt-2">
          启用账号
        </Checkbox>
      </div>
    </Modal>
  </Page>
</template>
