'use client';

import {
  FaLinkedin,
  FaTwitter,
  FaXTwitter,
  FaInstagram,
  FaYoutube,
  FaFacebook,
  FaTiktok,
  FaThreads,
  FaMedium,
  FaMicrophone,
  FaBlog,
  FaEnvelope,
  FaFileLines,
  FaNewspaper,
  FaVideo,
  FaPodcast,
} from 'react-icons/fa6';

import { SiSubstack } from 'react-icons/si';

import { LuFileText, LuMail, LuBookOpen } from 'react-icons/lu';
import { HiDocumentText } from 'react-icons/hi2';
import { cn } from '@/lib/utils';

// ─── Platform Icon Config ────────────────────────────────────────────────────

export interface PlatformIconConfig {
  key:         string;
  label:       string;
  Icon:        React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color:       string;      // Brand color hex
  bgColor:     string;      // Background tint (translucent)
  wordCount?:  string;
  description?:string;
}

export const PLATFORM_CONFIG: Record<string, PlatformIconConfig> = {
  canonical: {
    key:      'canonical',
    label:    'Canonical Draft',
    Icon:     HiDocumentText,
    color:    '#8B5CF6',
    bgColor:  'bg-violet-500/10',
  },
  linkedin_post: {
    key:       'linkedin_post',
    label:     'LinkedIn Post',
    Icon:      FaLinkedin,
    color:     '#0A66C2',
    bgColor:   'bg-[#0A66C2]/10',
    wordCount: '~300 words',
  },
  linkedin_article: {
    key:       'linkedin_article',
    label:     'LinkedIn Article',
    Icon:      FaLinkedin,
    color:     '#0A66C2',
    bgColor:   'bg-[#0A66C2]/10',
    wordCount: '~2000 words',
  },
  twitter_thread: {
    key:       'twitter_thread',
    label:     'Twitter/X Thread',
    Icon:      FaXTwitter,
    color:     '#000000',
    bgColor:   'bg-white/10',
    wordCount: '~280 words',
  },
  x_thread: {
    key:       'x_thread',
    label:     'X Thread',
    Icon:      FaXTwitter,
    color:     '#000000',
    bgColor:   'bg-white/10',
    wordCount: '~280 words',
  },
  twitter_post: {
    key:       'twitter_post',
    label:     'Twitter Post',
    Icon:      FaXTwitter,
    color:     '#000000',
    bgColor:   'bg-white/10',
    wordCount: '~140 words',
  },
  x_post: {
    key:       'x_post',
    label:     'X Post',
    Icon:      FaXTwitter,
    color:     '#000000',
    bgColor:   'bg-white/10',
    wordCount: '~140 words',
  },
  instagram_caption: {
    key:       'instagram_caption',
    label:     'Instagram Caption',
    Icon:      FaInstagram,
    color:     '#E4405F',
    bgColor:   'bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10',
    wordCount: '~150 words',
  },
  instagram_post: {
    key:       'instagram_post',
    label:     'Instagram Post',
    Icon:      FaInstagram,
    color:     '#E4405F',
    bgColor:   'bg-gradient-to-br from-purple-500/10 via-pink-500/10 to-orange-500/10',
    wordCount: '~150 words',
  },
  blog_post: {
    key:       'blog_post',
    label:     'Blog Post',
    Icon:      FaBlog,
    color:     '#F97316',
    bgColor:   'bg-orange-500/10',
    wordCount: '~3000 words',
  },
  blog: {
    key:       'blog',
    label:     'Blog',
    Icon:      FaBlog,
    color:     '#F97316',
    bgColor:   'bg-orange-500/10',
    wordCount: '~3000 words',
  },
  newsletter: {
    key:       'newsletter',
    label:     'Newsletter',
    Icon:      LuMail,
    color:     '#3B82F6',
    bgColor:   'bg-blue-500/10',
    wordCount: '~1000 words',
  },
  youtube_script: {
    key:       'youtube_script',
    label:     'YouTube Script',
    Icon:      FaYoutube,
    color:     '#FF0000',
    bgColor:   'bg-red-500/10',
    wordCount: '~1500 words',
  },
  podcast_notes: {
    key:       'podcast_notes',
    label:     'Podcast Notes',
    Icon:      FaMicrophone,
    color:     '#8B5CF6',
    bgColor:   'bg-violet-500/10',
    wordCount: '~500 words',
  },
  medium: {
    key:       'medium',
    label:     'Medium Article',
    Icon:      FaMedium,
    color:     '#00AB6C',
    bgColor:   'bg-green-500/10',
    wordCount: '~1500 words',
  },
  substack: {
    key:       'substack',
    label:     'Substack',
    Icon:      SiSubstack,
    color:     '#FF6719',
    bgColor:   'bg-orange-600/10',
    wordCount: '~1200 words',
  },
  facebook_post: {
    key:       'facebook_post',
    label:     'Facebook Post',
    Icon:      FaFacebook,
    color:     '#1877F2',
    bgColor:   'bg-blue-600/10',
    wordCount: '~250 words',
  },
  tiktok_script: {
    key:       'tiktok_script',
    label:     'TikTok Script',
    Icon:      FaTiktok,
    color:     '#000000',
    bgColor:   'bg-white/10',
    wordCount: '~150 words',
  },
  threads_post: {
    key:       'threads_post',
    label:     'Threads Post',
    Icon:      FaThreads,
    color:     '#000000',
    bgColor:   'bg-white/10',
    wordCount: '~200 words',
  },
};

// ─── Get Platform Config Helper ──────────────────────────────────────────────

export function getPlatformConfig(key: string): PlatformIconConfig {
  return PLATFORM_CONFIG[key] || {
    key,
    label: key.replace(/_/g, ' '),
    Icon: LuFileText,
    color: '#6B7280',
    bgColor: 'bg-gray-500/10',
  };
}

// ─── Reusable Icon Components ────────────────────────────────────────────────

interface PlatformIconProps {
  platform:  string;
  size?:     'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
};

/**
 * Standalone platform icon with brand color
 */
export function PlatformIcon({ platform, size = 'md', className }: PlatformIconProps) {
  const config = getPlatformConfig(platform);
  const { Icon, color } = config;
  
  return (
    <Icon
      className={cn(SIZE_CLASSES[size], className)}
      style={{ color }}
    />
  );
}

/**
 * Icon in a colored badge/pill background
 */
export function PlatformIconBadge({ 
  platform, 
  size = 'md', 
  className 
}: PlatformIconProps) {
  const config = getPlatformConfig(platform);
  const { Icon, color, bgColor } = config;

  const containerSize = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14',
  }[size];
  
  return (
    <div className={cn(
      'flex items-center justify-center rounded-lg shrink-0',
      bgColor,
      containerSize,
      className
    )}>
      <Icon
        className={SIZE_CLASSES[size]}
        style={{ color }}
      />
    </div>
  );
}

/**
 * Icon + Label combo (for use in tabs, lists)
 */
export function PlatformIconLabel({ 
  platform, 
  size = 'md',
  showWordCount = false,
  className 
}: PlatformIconProps & { showWordCount?: boolean }) {
  const config = getPlatformConfig(platform);
  const { Icon, color, label, wordCount } = config;
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Icon className={SIZE_CLASSES[size]} style={{ color }} />
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {showWordCount && wordCount && (
          <span className="text-xs text-muted-foreground">{wordCount}</span>
        )}
      </div>
    </div>
  );
}
