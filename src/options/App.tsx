import { useEffect, useState } from 'react';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '@/storage';
import { BUILTIN_PROVIDER_TEMPLATES, PROTOCOL_OPTIONS } from '@/llm/providers';
import type { Settings, ProviderSettings } from '@/storage/schema';
import type { LLMProtocol } from '@/llm/types';
import { t, initLocale, setLocale } from '@/i18n';
import { upsertTemplateProvider } from './provider-templates';

/** Generate a simple unique id (for custom providers) */
function genId(): string {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    initLocale().then(() => {
      loadSettings().then((s) => {
        const providers = { ...s.providers };
        for (const p of BUILTIN_PROVIDER_TEMPLATES) {
          if (!providers[p.id]) {
            providers[p.id] = {
              id: p.id,
              label: t(p.labelKey),
              protocol: p.protocol,
              baseURL: p.baseURL,
              apiKey: '',
              model: p.defaultModel,
              isCustom: false,
            };
          }
        }
        setSettings({ ...s, providers });
        setLoaded(true);
      });
    });
  }, []);

  if (!loaded) return <div style={{ padding: 24 }}>{t('common.loading')}</div>;

  const activeProvider = settings.providers[settings.activeProviderId];
  // Resolve display label: i18n key for built-in templates, stored label for custom
  const activeTemplate = BUILTIN_PROVIDER_TEMPLATES.find((x) => x.id === settings.activeProviderId);

  const updateApiKey = (key: string) => {
    setSettings((s) => ({
      ...s,
      providers: {
        ...s.providers,
        [s.activeProviderId]: { ...s.providers[s.activeProviderId], apiKey: key },
      },
    }));
  };

  const activate = (id: string) => setSettings((s) => ({ ...s, activeProviderId: id }));

  const changeLang = (lang: 'auto' | 'zh' | 'en') => {
    setSettings((s) => ({ ...s, uiLanguage: lang }));
    // Apply immediately for the current session
    if (lang === 'auto') {
      const browser = (navigator.language || 'zh').toLowerCase();
      setLocale(browser.startsWith('zh') ? 'zh' : 'en');
    } else {
      setLocale(lang);
    }
  };

  const handleSave = async () => {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // Reload to reflect any language change in the layout
    setTimeout(() => location.reload(), 300);
  };

  const providerList = Object.values(settings.providers);

  return (
    <div className="options-wrap">
      <header className="options-header">
        <h1>{t('options.title')}</h1>
        <p>{t('options.subtitle')}</p>
      </header>

      <div className="options-layout">
        {/* Left: provider list */}
        <aside className="provider-sidebar">
          <div className="sidebar-title">
            <span>{t('options.models')}</span>
          </div>
          <div className="provider-list">
            {providerList.map((p) => {
              const active = settings.activeProviderId === p.id;
              const sel = settings.activeProviderId === p.id;
              const hasKey = !!p.apiKey || p.protocol === 'ollama';
              // Resolve display name: built-in uses i18n key, custom uses stored label
              const tpl = BUILTIN_PROVIDER_TEMPLATES.find((x) => x.id === p.id);
              const name = tpl ? t(tpl.labelKey) : (p.label || t('placeholder.providerName'));
              return (
                <div
                  key={p.id}
                  className={`provider-item${sel ? ' selected' : ''}${active ? ' active' : ''}`}
                  onClick={() => activate(p.id)}
                >
                  <div className="provider-item-main">
                    <span className="provider-item-name">{name}</span>
                    <span className={`provider-item-status${hasKey ? ' ok' : ''}`}>
                      {active ? t('options.active') : hasKey ? t('options.configured') : t('options.notConfigured')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add from template */}
          <details className="add-template">
            <summary>{t('options.addFromTemplate')}</summary>
            <div className="template-options">
              {BUILTIN_PROVIDER_TEMPLATES.map((tp) => (
                <button
                  key={tp.id}
                  className="template-btn"
                  title={tp.hintKey ? t(tp.hintKey) : undefined}
                  onClick={() => setSettings((s) => upsertTemplateProvider(s, tp, t(tp.labelKey)))}
                >
                  {t(tp.labelKey)}
                </button>
              ))}
            </div>
          </details>
          <button className="btn btn-secondary btn-sm btn-block" onClick={() => {
            const id = genId();
            const newP: ProviderSettings = {
              id, label: t('placeholder.providerName'), protocol: 'openai-compat',
              baseURL: '', model: '', apiKey: '', isCustom: true,
            };
            setSettings((s) => ({ ...s, providers: { ...s.providers, [id]: newP } }));
            activate(id);
          }}>
            {t('options.addCustom')}
          </button>
        </aside>

        {/* Right: detail form */}
        <section className="provider-detail">
          {activeProvider ? (
            <>
              <div className="detail-header">
                <input
                  className="input label-input"
                  value={activeProvider.isCustom ? activeProvider.label : (activeTemplate ? t(activeTemplate.labelKey) : activeProvider.label)}
                  onChange={(e) => setSettings((s) => ({
                    ...s,
                    providers: { ...s.providers, [s.activeProviderId]: { ...s.providers[s.activeProviderId], label: e.target.value } },
                  }))}
                  placeholder={t('options.labelName')}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => activate(activeProvider.id)}
                  disabled={settings.activeProviderId === activeProvider.id}
                >
                  {settings.activeProviderId === activeProvider.id ? t('options.enabled') : t('options.setActive')}
                </button>
                {!activeProvider.isCustom && <span className="badge">{t('options.template')}</span>}
                {Object.keys(settings.providers).length > 1 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    setSettings((s) => {
                      const providers = { ...s.providers };
                      delete providers[activeProvider.id];
                      const activeProviderId = s.activeProviderId === activeProvider.id
                        ? Object.keys(providers)[0] : s.activeProviderId;
                      return { ...s, providers, activeProviderId };
                    });
                  }}>
                    {t('options.delete')}
                  </button>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">{t('options.protocol')}</label>
                <select
                  className="input"
                  value={activeProvider.protocol}
                  onChange={(e) => setSettings((s) => ({
                    ...s,
                    providers: { ...s.providers, [s.activeProviderId]: { ...s.providers[s.activeProviderId], protocol: e.target.value as LLMProtocol } },
                  }))}
                >
                  {PROTOCOL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {t(o.labelKey)}（{t(o.descKey)}）
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t('options.baseURL')}</label>
                <input
                  className="input mono"
                  value={activeProvider.baseURL}
                  onChange={(e) => setSettings((s) => ({
                    ...s,
                    providers: { ...s.providers, [s.activeProviderId]: { ...s.providers[s.activeProviderId], baseURL: e.target.value } },
                  }))}
                  placeholder={t('placeholder.baseURL')}
                />
                <p className="form-hint">{t(`hint.${activeProvider.protocol}`)}</p>
              </div>

              <div className="form-group">
                <label className="form-label">{t('options.model')}</label>
                <input
                  className="input mono"
                  value={activeProvider.model}
                  onChange={(e) => setSettings((s) => ({
                    ...s,
                    providers: { ...s.providers, [s.activeProviderId]: { ...s.providers[s.activeProviderId], model: e.target.value } },
                  }))}
                  placeholder={t('placeholder.model')}
                />
              </div>

              {activeProvider.protocol !== 'ollama' && (
                <div className="form-group">
                  <label className="form-label">{t('options.apiKey')}</label>
                  <div className="apikey-row">
                    <input
                      type={showKey ? 'text' : 'password'}
                      className="input mono"
                      value={activeProvider.apiKey}
                      onChange={(e) => updateApiKey(e.target.value)}
                      placeholder={t('placeholder.apiKey')}
                    />
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowKey((v) => !v)}>
                      {showKey ? t('options.hide') : t('options.show')}
                    </button>
                  </div>
                </div>
              )}
              {activeProvider.protocol === 'ollama' && (
                <p className="form-hint ollama-hint">
                  {t('hint.ollamaNote', { cmd: `ollama pull ${activeProvider.model || 'llama3'}` })}
                </p>
              )}

              {/* Language setting */}
              <div className="form-group">
                <label className="form-label">{t('options.lang')}</label>
                <select
                  className="input"
                  value={settings.uiLanguage}
                  onChange={(e) => changeLang(e.target.value as 'auto' | 'zh' | 'en')}
                >
                  <option value="auto">{t('options.langAuto')}</option>
                  <option value="zh">中文</option>
                  <option value="en">English</option>
                </select>
              </div>
            </>
          ) : (
            <div className="empty-detail">{t('common.loading')}</div>
          )}
        </section>
      </div>

      <footer className="options-footer">
        {saved && <span className="saved-tip">{t('options.saved')}</span>}
        <button className="btn btn-primary" onClick={handleSave}>{t('options.save')}</button>
      </footer>
    </div>
  );
}
