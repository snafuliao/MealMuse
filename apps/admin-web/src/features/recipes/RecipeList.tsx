import type { RecipeListQuery, RecipeStatus } from '@mealmuse/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { recipes } from '../../api/client';
import {
  ALLERGEN_LABELS,
  COURSE_LABELS,
  formatTime,
  MEAL_TYPE_LABELS,
  options,
  SOURCE_LABELS,
  STATUS_LABELS,
} from './labels';

type Props = {
  /** 审核队列固定只看待审核的菜。 */
  fixedStatus?: RecipeStatus;
  onOpen(id: string): void;
  onCreate?(): void;
};

type Filters = Omit<RecipeListQuery, 'page' | 'pageSize'>;
const PAGE_SIZE = 20;

export function RecipeList({ fixedStatus, onOpen, onCreate }: Props) {
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const query = { ...filters, ...(fixedStatus ? { status: fixedStatus } : {}), page };
  const list = useQuery({
    queryKey: ['recipes', query],
    queryFn: () => recipes.list({ ...query, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const set = (key: keyof Filters) => (e: { target: { value: string } }) => {
    setFilters((f) => ({ ...f, [key]: e.target.value || undefined }));
    setPage(1);
  };
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <div className="card row filters">
        <label>
          菜名
          <input value={filters.q ?? ''} onChange={set('q')} placeholder="搜索菜名" />
        </label>
        {!fixedStatus && (
          <label>
            状态
            <select value={filters.status ?? ''} onChange={set('status')}>
              <option value="">全部</option>
              {options(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          来源
          <select value={filters.source ?? ''} onChange={set('source')}>
            <option value="">全部</option>
            {options(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          类别
          <select value={filters.course ?? ''} onChange={set('course')}>
            <option value="">全部</option>
            {options(COURSE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          餐次
          <select value={filters.mealType ?? ''} onChange={set('mealType')}>
            <option value="">全部</option>
            {options(MEAL_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          菜系
          <input value={filters.cuisine ?? ''} onChange={set('cuisine')} placeholder="如 川菜" />
        </label>
        <span className="spacer" />
        {onCreate && (
          <button type="button" onClick={onCreate}>
            新建菜谱
          </button>
        )}
      </div>
      {list.isError && <p role="alert">{list.error.message}</p>}
      <p className="hint">
        {list.data ? `共 ${list.data.total} 道` : '加载中…'}
        {fixedStatus && '。模型生成的新菜在这里审核：打开后可以修改，再发布或驳回。'}
      </p>
      <table>
        <thead>
          <tr>
            <th>菜名</th>
            <th>类别</th>
            <th>餐次</th>
            <th>菜系</th>
            <th>用时</th>
            <th>过敏原</th>
            <th>状态</th>
            <th>来源</th>
            <th>更新时间</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.items.map((r) => (
            <tr key={r.id}>
              <td>
                <button type="button" className="link" onClick={() => onOpen(r.id)}>
                  {r.name}
                </button>
              </td>
              <td>{COURSE_LABELS[r.course]}</td>
              <td>{r.mealTypes.map((m) => MEAL_TYPE_LABELS[m]).join('、')}</td>
              <td>{r.cuisine ?? '—'}</td>
              <td>{r.prepMinutes + r.cookMinutes} 分钟</td>
              <td>{r.allergenTags.map((a) => ALLERGEN_LABELS[a]).join('、') || '—'}</td>
              <td>{STATUS_LABELS[r.status]}</td>
              <td>{SOURCE_LABELS[r.source]}</td>
              <td>{formatTime(r.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="actions pager">
        <button
          type="button"
          className="secondary"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          上一页
        </button>
        <span>
          第 {page} / {pages} 页
        </span>
        <button
          type="button"
          className="secondary"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          下一页
        </button>
      </div>
    </>
  );
}
