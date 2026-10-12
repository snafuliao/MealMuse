import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { users } from '../../api/client';

const formatTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('zh-CN') : '—');

export function UsersPanel() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['users'], queryFn: users.list });
  const revoke = useMutation({
    mutationFn: users.revokeDevice,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <>
      <h2>用户与设备</h2>
      {list.isError && <p role="alert">{list.error.message}</p>}
      <table>
        <thead>
          <tr>
            <th>昵称</th>
            <th>角色</th>
            <th>注册时间</th>
            <th>最近活跃</th>
            <th>设备</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.map((user) => (
            <tr key={user.id}>
              <td>{user.displayName}</td>
              <td>{user.role === 'admin' ? '管理员' : '成员'}</td>
              <td>{formatTime(user.createdAt)}</td>
              <td>{formatTime(user.lastActiveAt)}</td>
              <td>
                {user.devices.length === 0 && '—'}
                {user.devices.map((device) => (
                  <div key={device.id} className="row">
                    <span>{device.deviceName}</span>
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        if (window.confirm(`撤销「${device.deviceName}」的登录？`))
                          revoke.mutate(device.id);
                      }}
                    >
                      撤销
                    </button>
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
