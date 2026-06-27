import { useEffect, useState } from 'react';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '@/storage';
import { BUILTIN_PROVIDER_TEMPLATES, PROTOCOL_OPTIONS } from '@/llm/providers';
import type { Settings, ProviderSettings } from '@/storage/schema';
import type { LLMProtocol } from '@/llm/types';

/** 生成简单唯一 id（自定义 provider 用） */
function genId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setSelectedId(s.activeProviderId);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <div style={{ padding: 24 }}>加载中...</div>;

  const selected = settings.providers[selectedId];

  /** 新建自定义 provider */
  const addCustom = () => {
    const id = genId();
    const newP: ProviderSettings = {
      id,
      label: '自定义',
      protocol: 'openai-compat',
      baseURL: '',
      model: '',
      apiKey: '',
      isCustom: true,
    };
    setSettings((s) => ({ ...s, providers: { ...s.providers, [id]: newP } }));
    setSelectedId(id);
  };

  /** 从模板一键添加（填好协议+地址+默认模型，用户只需填 Key） */
  const addFromTemplate = (tplId: string) => {
    const tpl = BUILTIN_PROVIDER_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    const id = genId();
    const newP: ProviderSettings = {
      id,
      label: tpl.label,
      protocol: tpl.protocol,
      baseURL: tpl.baseURL,
      model: tpl.defaultModel,
      apiKey: '',
      isCustom: false,
    };
    setSettings((s) => ({ ...s, providers: { ...s.providers, [id]: newP } }));
    setSelectedId(id);
  };

  /** 删除 provider（不能删最后一个） */
  const removeProvider = (id: string) => {
    if (Object.keys(settings.providers).length <= 1) return;
    setSettings((s) => {
      const providers = { ...s.providers };
      delete providers[id];
      const activeProviderId = s.activeProviderId === id
        ? Object.keys(providers)[0]
        : s.activeProviderId;
      return { ...s, providers, activeProviderId };
    });
    if (selectedId === id) setSelectedId(settings.activeProviderId);
  };

  /** 更新选中 provider 的字段 */
  const updateField = <K extends keyof ProviderSettings>(key: K, value: ProviderSettings[K]) => {
    setSettings((s) => ({
      ...s,
      providers: {
        ...s.providers,
        [selectedId]: { ...s.providers[selectedId], [key]: value },
      },
    }));
  };

  /** 设为当前启用的 provider */
  const setActive = (id: string) => setSettings((s) => ({ ...s, activeProviderId: id }));

  const handleSave = async () => {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const providerList = Object.values(settings.providers);
  const usedTemplateIds = new Set(providerList.filter((p) => !p.isCustom).map((p) => p.label));

  return (
    <div className="options-wrap">
      <header className="options-header">
        <h1>设置</h1>
        <p>配置大模型接入。可自由选择接口协议、填写接口地址和模型名。API Key 仅存储在本地浏览器。</p>
      </header>

      <div className="options-layout">
        {/* 左侧：provider 列表 */}
        <aside className="provider-sidebar">
          <div className="sidebar-title">
            <span>模型配置</span>
          </div>
          <div className="provider-list">
            {providerList.map((p) => {
              const active = settings.activeProviderId === p.id;
              const sel = selectedId === p.id;
              const hasKey = !!p.apiKey || p.protocol === 'ollama';
              return (
                <div
                  key={p.id}
                  className={`provider-item${sel ? ' selected' : ''}${active ? ' active' : ''}`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <div className="provider-item-main">
                    <span className="provider-item-name">{p.label || '未命名'}</span>
                    <span className={`provider-item-status${hasKey ? ' ok' : ''}`}>
                      {active ? '● 启用中' : hasKey ? '已配置' : '未配置'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 从模板添加 */}
          <details className="add-template">
            <summary>+ 从模板添加</summary>
            <div className="template-options">
              {BUILTIN_PROVIDER_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  className="template-btn"
                  onClick={() => addFromTemplate(t.id)}
                  title={t.hint}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </details>
          <button className="btn btn-secondary btn-sm btn-block" onClick={addCustom}>
            + 新建自定义
          </button>
        </aside>

        {/* 右侧：详情表单 */}
        <section className="provider-detail">
          {selected ? (
            <>
              <div className="detail-header">
                <input
                  className="input label-input"
                  value={selected.label}
                  onChange={(e) => updateField('label', e.target.value)}
                  placeholder="配置名称"
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setActive(selected.id)}
                  disabled={settings.activeProviderId === selected.id}
                >
                  {settings.activeProviderId === selected.id ? '已启用' : '设为启用'}
                </button>
                {!selected.isCustom && (
                  <span className="badge">模板</span>
                )}
                {Object.keys(settings.providers).length > 1 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => removeProvider(selected.id)}>
                    🗑 删除
                  </button>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">接口协议</label>
                <select
                  className="input"
                  value={selected.protocol}
                  onChange={(e) => updateField('protocol', e.target.value as LLMProtocol)}
                >
                  {PROTOCOL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}（{o.desc}）
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">接口地址 (Base URL)</label>
                <input
                  className="input mono"
                  value={selected.baseURL}
                  onChange={(e) => updateField('baseURL', e.target.value)}
                  placeholder="https://api.example.com/v1"
                />
                <p className="form-hint">
                  {selected.protocol === 'openai-compat' && '填到 /v1 这一级，例如 https://api.deepseek.com/v1'}
                  {selected.protocol === 'claude' && '填到根域名，例如 https://api.anthropic.com'}
                  {selected.protocol === 'ollama' && '本地服务地址，例如 http://localhost:11434'}
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">模型名</label>
                <input
                  className="input mono"
                  value={selected.model}
                  onChange={(e) => updateField('model', e.target.value)}
                  placeholder="如 deepseek-chat / gpt-4o-mini / claude-3-5-sonnet-20241022"
                />
              </div>

              {selected.protocol !== 'ollama' && (
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <div className="apikey-row">
                    <input
                      type={showKey ? 'text' : 'password'}
                      className="input mono"
                      value={selected.apiKey}
                      onChange={(e) => updateField('apiKey', e.target.value)}
                      placeholder="sk-..."
                    />
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowKey((v) => !v)}>
                      {showKey ? '隐藏' : '显示'}
                    </button>
                  </div>
                </div>
              )}
              {selected.protocol === 'ollama' && (
                <p className="form-hint ollama-hint">
                  💡 Ollama 无需 API Key。请确保本地已运行 Ollama 并拉取了对应模型（<code>ollama pull {selected.model || 'llama3'}</code>）。
                </p>
              )}
            </>
          ) : (
            <div className="empty-detail">从左侧选择或新建一个配置</div>
          )}
        </section>
      </div>

      <footer className="options-footer">
        {saved && <span className="saved-tip">✓ 已保存</span>}
        <button className="btn btn-primary" onClick={handleSave}>保存设置</button>
      </footer>
    </div>
  );
}
