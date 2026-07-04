'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingForm {
  // Step 1
  industry:  string;
  teamSize:  string;
  useCase:   string;
  // Step 2
  brandName:        string;
  missionStatement: string;
  lifePurpose:      string;
  formality:        number;
  confidence:       number;
  enthusiasm:       number;
  empathy:          number;
  // Step 3
  platforms:         string[];
  language:          string;
  defaultStructure:  string;
  // Step 4
  inviteEmails: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'org',         label: 'Organization',    icon: '🏢' },
  { id: 'brand',       label: 'Brand Profile',   icon: '◉'  },
  { id: 'preferences', label: 'Preferences',     icon: '⚙️' },
  { id: 'team',        label: 'Invite Team',     icon: '👥' },
];

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Consulting',
  'Marketing', 'Media & Publishing', 'Research', 'Legal',
  'E-commerce', 'Education', 'Real Estate', 'Other',
];

const TEAM_SIZES = [
  { value: 'solo',    label: 'Just me'  },
  { value: '2-10',    label: '2-10'     },
  { value: '11-50',   label: '11-50'    },
  { value: '51-200',  label: '51-200'   },
  { value: '200+',    label: '200+'     },
];

const USE_CASES = [
  { value: 'thought_leadership', label: 'Thought Leadership', icon: '💡' },
  { value: 'product_marketing',  label: 'Product Marketing',  icon: '📦' },
  { value: 'content_agency',     label: 'Content Agency',     icon: '🏭' },
  { value: 'research',           label: 'Research Publishing',icon: '🔬' },
  { value: 'social_media',       label: 'Social Media',       icon: '📱' },
  { value: 'personal_brand',     label: 'Personal Brand',     icon: '🌟' },
];

const PLATFORMS = [
  { id: 'linkedin_post',      label: 'LinkedIn Posts',     icon: '💼' },
  { id: 'linkedin_article',   label: 'LinkedIn Articles',  icon: '📰' },
  { id: 'twitter_thread',     label: 'Twitter/X Threads',  icon: '🐦' },
  { id: 'blog_post',          label: 'Blog Posts',         icon: '✍️' },
  { id: 'newsletter',         label: 'Newsletter',         icon: '📧' },
  { id: 'instagram_caption',  label: 'Instagram Captions', icon: '📸' },
  { id: 'youtube_script',     label: 'YouTube Scripts',    icon: '🎬' },
];

const WRITING_STRUCTURES = [
  { value: 'thesis',    label: 'Thesis',          desc: 'Bold claim + evidence'      },
  { value: 'story',     label: 'Storytelling',    desc: 'Setup → conflict → lesson'  },
  { value: 'debate',    label: 'Debate',          desc: 'Contrarian take'            },
  { value: 'listicle',  label: 'Listicle',        desc: 'Key points as list'         },
  { value: 'opinion',   label: 'Hot Take',        desc: 'Bold unconventional view'   },
];

const TONE_SLIDERS = [
  { key: 'formality',   label: 'Formality',   left: 'Casual',   right: 'Formal'     },
  { key: 'confidence',  label: 'Confidence',  left: 'Gentle',   right: 'Bold'       },
  { key: 'enthusiasm',  label: 'Enthusiasm',  left: 'Reserved', right: 'Energetic'  },
  { key: 'empathy',     label: 'Empathy',     left: 'Direct',   right: 'Empathetic' },
];

// ─── Step Components ──────────────────────────────────────────────────────────

function StepOrg({
  form,
  update,
}: {
  form:   OnboardingForm;
  update: (key: keyof OnboardingForm, val: unknown) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Industry */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Industry *
        </label>
        <div className="grid grid-cols-3 gap-2">
          {INDUSTRIES.map(ind => (
            <button
              key={ind}
              onClick={() => update('industry', ind)}
              className={`px-3 py-2.5 text-xs rounded-xl border transition-all ${
                form.industry === ind
                  ? 'bg-violet-600/20 border-violet-500 text-violet-300 font-medium'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
              }`}
            >
              {ind}
            </button>
          ))}
        </div>
      </div>

      {/* Team Size */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Team Size *
        </label>
        <div className="flex gap-2">
          {TEAM_SIZES.map(s => (
            <button
              key={s.value}
              onClick={() => update('teamSize', s.value)}
              className={`flex-1 py-2.5 text-xs rounded-xl border transition-all ${
                form.teamSize === s.value
                  ? 'bg-violet-600/20 border-violet-500 text-violet-300 font-medium'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Use Case */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Primary Use Case
        </label>
        <div className="grid grid-cols-2 gap-2">
          {USE_CASES.map(u => (
            <button
              key={u.value}
              onClick={() => update('useCase', u.value)}
              className={`flex items-center gap-3 px-3 py-3 text-left rounded-xl border transition-all ${
                form.useCase === u.value
                  ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'
              }`}
            >
              <span className="text-xl">{u.icon}</span>
              <span className="text-xs font-medium">{u.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepBrand({
  form,
  update,
}: {
  form:   OnboardingForm;
  update: (key: keyof OnboardingForm, val: unknown) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Brand / Person Name *
        </label>
        <input
          value={form.brandName}
          onChange={e => update('brandName', e.target.value)}
          placeholder="e.g. Sameer Thakur or Acme Corp"
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-colors"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Mission Statement
        </label>
        <textarea
          value={form.missionStatement}
          onChange={e => update('missionStatement', e.target.value)}
          placeholder="What does your brand stand for? Why do you do what you do?"
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-colors resize-none text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Life Purpose
          <span className="ml-1 text-xs text-gray-600">(optional)</span>
        </label>
        <textarea
          value={form.lifePurpose}
          onChange={e => update('lifePurpose', e.target.value)}
          placeholder="What change do you want to create? What's the deeper 'why'?"
          rows={2}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-colors resize-none text-sm"
        />
      </div>

      {/* Tone Sliders */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Brand Tone
        </label>
        <div className="space-y-4">
          {TONE_SLIDERS.map(({ key, label, left, right }) => {
            const value = form[key as keyof OnboardingForm] as number;
            return (
              <div key={key}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-gray-400">{label}</span>
                  <span className="text-xs text-violet-400 font-medium">{value}/10</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-14 text-right">{left}</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={value}
                    onChange={e => update(key as keyof OnboardingForm, Number(e.target.value))}
                    className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #7c3aed ${(value - 1) * 11.1}%, rgba(255,255,255,0.1) ${(value - 1) * 11.1}%)`
                    }}
                  />
                  <span className="text-xs text-gray-600 w-14">{right}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepPreferences({
  form,
  update,
}: {
  form:   OnboardingForm;
  update: (key: keyof OnboardingForm, val: unknown) => void;
}) {
  const toggle = (id: string) => {
    const curr = form.platforms;
    update(
      'platforms',
      curr.includes(id) ? curr.filter(p => p !== id) : [...curr, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Platforms */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Preferred Platforms *
        </label>
        <p className="text-xs text-gray-600 mb-3">
          Select all platforms you plan to publish on
        </p>
        <div className="space-y-2">
          {PLATFORMS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                form.platforms.includes(id)
                  ? 'bg-violet-600/20 border-violet-500'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <span className="text-lg">{icon}</span>
              <span className={`text-sm font-medium ${
                form.platforms.includes(id) ? 'text-violet-300' : 'text-gray-400'
              }`}>
                {label}
              </span>
              {form.platforms.includes(id) && (
                <span className="ml-auto text-violet-400 text-sm">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Default Structure */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Preferred Writing Structure
        </label>
        <div className="grid grid-cols-1 gap-2">
          {WRITING_STRUCTURES.map(s => (
            <button
              key={s.value}
              onClick={() => update('defaultStructure', s.value)}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left ${
                form.defaultStructure === s.value
                  ? 'bg-violet-600/20 border-violet-500'
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              <div>
                <p className={`text-sm font-medium ${
                  form.defaultStructure === s.value ? 'text-violet-300' : 'text-white'
                }`}>
                  {s.label}
                </p>
                <p className="text-xs text-gray-600">{s.desc}</p>
              </div>
              {form.defaultStructure === s.value && (
                <span className="text-violet-400">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">
          Default Language
        </label>
        <select
          value={form.language}
          onChange={e => update('language', e.target.value)}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-violet-500/50 transition-colors"
        >
          {['English', 'Hindi', 'Hinglish', 'Spanish', 'French', 'German', 'Arabic', 'Portuguese'].map(l => (
            <option key={l} value={l} className="bg-[#0F0F10]">{l}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

function StepTeam({
  form,
  update,
}: {
  form:   OnboardingForm;
  update: (key: keyof OnboardingForm, val: unknown) => void;
}) {
  const updateEmail = (index: number, value: string) => {
    const updated = [...form.inviteEmails];
    updated[index] = value;
    update('inviteEmails', updated);
  };

  const validEmails = form.inviteEmails.filter(e =>
    e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
  );

  return (
    <div className="space-y-5">
      <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
        <p className="text-sm text-violet-300 font-medium">🎉 Almost done!</p>
        <p className="text-xs text-violet-300/70 mt-1">
          Invite colleagues to collaborate. They'll receive an email invitation.
        </p>
      </div>

      <div className="space-y-3">
        {form.inviteEmails.map((email, i) => (
          <div key={i} className="relative">
            <input
              type="email"
              value={email}
              onChange={e => updateEmail(i, e.target.value)}
              placeholder={`teammate${i + 1}@company.com`}
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:border-violet-500/50 outline-none transition-colors text-sm"
            />
            {email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-400 text-sm">
                ✓
              </span>
            )}
          </div>
        ))}
      </div>

      {validEmails.length > 0 && (
        <p className="text-xs text-green-400">
          ✓ {validEmails.length} invite{validEmails.length !== 1 ? 's' : ''} ready to send
        </p>
      )}

      <p className="text-xs text-gray-600 text-center">
        You can also invite team members later from Settings → Team
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router     = useRouter();
  const fetchMe    = useAuthStore(s => s.fetchMe);
  const [step,  setStep]  = useState(0); // 0-indexed
  const [error, setError] = useState('');

  const [form, setForm] = useState<OnboardingForm>({
    industry:         '',
    teamSize:         '',
    useCase:          '',
    brandName:        '',
    missionStatement: '',
    lifePurpose:      '',
    formality:        6,
    confidence:       7,
    enthusiasm:       6,
    empathy:          6,
    platforms:        [],
    language:         'English',
    defaultStructure: 'thesis',
    inviteEmails:     ['', '', '', '', ''],
  });

  const update = (key: keyof OnboardingForm, val: unknown) => {
    setForm(f => ({ ...f, [key]: val }));
  };

  // Save onboarding data
  const saveMutation = useMutation({
    mutationFn: async () => {
      // 1. Save onboarding data
      await api.post('/auth/onboarding', {
        industry:      form.industry,
        teamSize:      form.teamSize,
        useCase:       form.useCase,
        language:      form.language,
        defaultStructure: form.defaultStructure,
      });

      // 2. Create brand profile
      if (form.brandName) {
        await api.post('/brand', {
          name:             form.brandName,
          missionStatement: form.missionStatement,
          lifePurpose:      form.lifePurpose,
          tone: {
            formality:   form.formality,
            confidence:  form.confidence,
            enthusiasm:  form.enthusiasm,
            empathy:     form.empathy,
          },
          isDefault: true,
        });
      }

      // 3. Send invites (valid emails only)
      const validEmails = form.inviteEmails.filter(e =>
        e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
      );

      await Promise.allSettled(
        validEmails.map(email =>
          api.post('/team/invite', { email, role: 'writer' })
        )
      );
    },
    onSuccess: async () => {
      await fetchMe(); // Refresh user data
      router.replace('/dashboard');
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  // Step validation
  const canProceed = (): boolean => {
    switch (step) {
      case 0: return !!form.industry && !!form.teamSize;
      case 1: return !!form.brandName.trim();
      case 2: return form.platforms.length > 0;
      case 3: return true; // Invites are optional
      default: return true;
    }
  };

  const STEP_COMPONENTS = [
    <StepOrg       key="org"   form={form} update={update} />,
    <StepBrand     key="brand" form={form} update={update} />,
    <StepPreferences key="prefs" form={form} update={update} />,
    <StepTeam      key="team"  form={form} update={update} />,
  ];

  return (
    <div className="min-h-screen bg-[#080809] flex items-center justify-center p-6">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Let&apos;s set you up</h1>
          <p className="text-gray-500 text-sm mt-1">
            {STEPS[step].icon} {STEPS[step].label}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-6">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i < step  ? 'bg-violet-500' :
                i === step ? 'bg-violet-600' :
                'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="bg-white/3 border border-white/10 rounded-2xl p-6 min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Step Header */}
              <div className="mb-5">
                <h2 className="text-base font-semibold text-white">
                  {STEPS[step].label}
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Step {step + 1} of {STEPS.length}
                </p>
              </div>

              {STEP_COMPONENTS[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : router.replace('/dashboard')}
            className="px-5 py-2.5 text-sm text-gray-500 hover:text-white transition-colors"
          >
            {step === 0 ? '← Skip setup' : '← Back'}
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-all"
            >
              Continue →
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => router.replace('/dashboard')}
                className="px-4 py-2.5 text-sm text-gray-500 hover:text-white border border-white/10 rounded-xl transition-all"
              >
                Skip
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-medium rounded-xl transition-all"
              >
                {saveMutation.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Setting up...
                  </>
                ) : (
                  '✓ Finish Setup'
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
