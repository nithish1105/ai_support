import { useEffect, useState } from 'react';
import {
  BookOpen, Plus, Pencil, Trash2, X, Check, Search,
  ChevronDown, ChevronUp, Tag, FileText, Loader2,
} from 'lucide-react';
import { knowledgeAPI } from '../../services/api';
import { KnowledgeArticle, TicketCategory } from '../../types';
import AdminSidebar from '../../components/admin/AdminSidebar';

const CATEGORIES: string[] = [
  'Technical Issue', 'Internet Problem', 'Billing Problem', 'Payment Problem',
  'Refund', 'Account Problem', 'Password', 'Order', 'Delivery', 'Subscription',
  'Cancellation', 'Product Information', 'Complaint', 'Feedback', 'Other',
];

interface ArticleFormData {
  title: string;
  category: string;
  problem_description: string;
  solution: string;
  steps: string;
  keywords: string;
}

const EMPTY_FORM: ArticleFormData = {
  title: '',
  category: 'Other',
  problem_description: '',
  solution: '',
  steps: '',
  keywords: '',
};

function ArticleModal({
  article,
  onClose,
  onSave,
}: {
  article: KnowledgeArticle | null;
  onClose: () => void;
  onSave: (data: ArticleFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<ArticleFormData>(
    article
      ? {
          title: article.title,
          category: article.category,
          problem_description: article.problem_description,
          solution: article.solution,
          steps: article.steps ?? '',
          keywords: article.keywords ?? '',
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.problem_description.trim() || !form.solution.trim()) {
      setErr('Title, problem description, and solution are required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await onSave(form);
      onClose();
    } catch {
      setErr('Failed to save article. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: keyof ArticleFormData,
    type: 'input' | 'textarea' = 'input',
    placeholder = '',
    required = false
  ) => (
    <div>
      <label className="block text-sm font-medium text-black mb-1.5">
        {label} {required && <span className="text-orange-500">*</span>}
      </label>
      {type === 'input' ? (
        <input
          type="text"
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          className="input-field text-sm py-2.5"
        />
      ) : (
        <textarea
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          placeholder={placeholder}
          rows={4}
          className="input-field text-sm py-2.5 resize-none"
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-black">
            {article ? 'Edit Article' : 'New Knowledge Article'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-black transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {field('Title', 'title', 'input', 'e.g. How to reset password', true)}

          <div>
            <label className="block text-sm font-medium text-black mb-1.5">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input-field text-sm py-2.5 appearance-none cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {field('Problem Description', 'problem_description', 'textarea', 'Describe the problem this article addresses...', true)}
          {field('Solution', 'solution', 'textarea', 'Explain the solution clearly...', true)}
          {field('Steps (optional)', 'steps', 'textarea', 'Step 1: ...\nStep 2: ...')}
          {field('Keywords (optional)', 'keywords', 'input', 'comma-separated keywords')}

          {err && <p className="text-orange-600 text-sm font-medium">{err}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-sm py-2 px-5">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary text-sm py-2 px-5 flex items-center gap-2">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {article ? 'Save Changes' : 'Create Article'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ArticleCard({
  article,
  onEdit,
  onDelete,
}: {
  article: KnowledgeArticle;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${article.title}"?`)) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="badge-orange">{article.category}</span>
              {!article.is_active && (
                <span className="badge-black">Inactive</span>
              )}
            </div>
            <h3 className="font-semibold text-black text-sm">{article.title}</h3>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{article.problem_description}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={onEdit}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-black transition-colors"
              title="Edit"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="p-2 rounded-lg hover:bg-orange-50 text-gray-500 hover:text-orange-600 transition-colors"
              title="Delete"
            >
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-black transition-colors"
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Solution</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{article.solution}</p>
            </div>
            {article.steps && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Steps</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{article.steps}</p>
              </div>
            )}
            {article.keywords && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag size={13} className="text-gray-400" />
                {article.keywords.split(',').map((k) => k.trim()).filter(Boolean).map((k) => (
                  <span key={k} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {k}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminKnowledgePage() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<KnowledgeArticle | null>(null);

  const fetchArticles = () => {
    setLoading(true);
    knowledgeAPI
      .list()
      .then((res) => setArticles(res.data ?? []))
      .catch(() => setError('Failed to load knowledge base.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchArticles();
  }, []);

  const filtered = articles.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      a.title.toLowerCase().includes(q) ||
      a.problem_description.toLowerCase().includes(q) ||
      a.solution.toLowerCase().includes(q) ||
      (a.keywords ?? '').toLowerCase().includes(q);
    const matchCat = !catFilter || a.category === catFilter;
    return matchSearch && matchCat;
  });

  const handleSave = async (data: ArticleFormData) => {
    if (editing) {
      await knowledgeAPI.update(editing.id, data);
    } else {
      await knowledgeAPI.create(data);
    }
    await fetchArticles();
  };

  const handleDelete = async (id: number) => {
    await knowledgeAPI.delete(id);
    setArticles((prev) => prev.filter((a) => a.id !== id));
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (article: KnowledgeArticle) => {
    setEditing(article);
    setModalOpen(true);
  };

  return (
    <div className="flex min-h-screen bg-[#F8F8F8]">
      <AdminSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-black">Knowledge Base</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {filtered.length} article{filtered.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={openCreate} className="btn-primary text-sm py-2 px-5 flex items-center gap-2">
              <Plus size={16} />
              New Article
            </button>
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Filters */}
          <div className="card p-4 mb-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search articles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9 py-2 text-sm"
              />
            </div>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="input-field py-2 text-sm pr-8 appearance-none cursor-pointer min-w-[180px]"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="card p-8 text-center">
              <p className="text-orange-600 font-medium">{error}</p>
              <button onClick={fetchArticles} className="btn-primary mt-4 text-sm py-2 px-5">
                Retry
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && filtered.length === 0 && (
            <div className="card p-12 text-center">
              <BookOpen size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No articles found</p>
              <p className="text-gray-400 text-sm mt-1 mb-4">
                {articles.length === 0
                  ? 'Create your first knowledge base article.'
                  : 'Try adjusting your search or category filter.'}
              </p>
              {articles.length === 0 && (
                <button onClick={openCreate} className="btn-primary text-sm py-2 px-5">
                  Create Article
                </button>
              )}
            </div>
          )}

          {/* Articles */}
          {!loading && !error && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onEdit={() => openEdit(article)}
                  onDelete={() => handleDelete(article.id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {modalOpen && (
        <ArticleModal
          article={editing}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
