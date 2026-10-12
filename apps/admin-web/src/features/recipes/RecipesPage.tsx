import { useState } from 'react';
import { IngredientsPanel } from './IngredientsPanel';
import { RecipeEditor } from './RecipeEditor';
import { RecipeList } from './RecipeList';
import { SeedImportsPanel } from './SeedImportsPanel';

const SECTIONS = [
  { id: 'list', label: '菜谱' },
  { id: 'review', label: '审核队列' },
  { id: 'ingredients', label: '食材库' },
  { id: 'imports', label: '导入记录' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

/** 菜谱管理：列表与编辑、审核队列、食材库、种子导入记录（docs/product-specs/admin.md 第 3 节）。 */
export function RecipesPage() {
  const [section, setSection] = useState<SectionId>('list');
  // null：显示列表；'new'：新建；其他：编辑该菜谱。
  const [editing, setEditing] = useState<string | null>(null);

  if (editing) {
    return (
      <RecipeEditor
        recipeId={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onCreated={setEditing}
      />
    );
  }

  return (
    <section>
      <div className="subnav" role="tablist">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === section}
            className={item.id === section ? 'active' : ''}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {section === 'list' && <RecipeList onOpen={setEditing} onCreate={() => setEditing('new')} />}
      {section === 'review' && <RecipeList fixedStatus="pending_review" onOpen={setEditing} />}
      {section === 'ingredients' && <IngredientsPanel />}
      {section === 'imports' && <SeedImportsPanel onOpenRecipe={setEditing} />}
    </section>
  );
}
