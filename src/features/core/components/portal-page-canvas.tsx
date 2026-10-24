'use client';
// src/features/core/components/portal-page-canvas.tsx (A · REQ-052, CR-A-10) — 고객 프로젝트 화면: 지금 보는 탭의 이미지를 골라 PageCanvas 로
import type { ReactNode } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { PORTAL_TABS, type PortalTab } from '@/shared/contracts/screens';
import type { PageImages, PageTone } from '../page-theme';
import { PageCanvas } from './page-canvas';

export function PortalPageCanvas({
  tone,
  images,
  children,
}: {
  tone: PageTone;
  images: PageImages;
  children: ReactNode;
}) {
  const segment = useSelectedLayoutSegment();
  const tab = (PORTAL_TABS as readonly string[]).includes(segment ?? '')
    ? (segment as PortalTab)
    : null;
  return (
    <PageCanvas tone={tone} imageFileId={tab ? images[tab] : null} variant="fixed">
      {children}
    </PageCanvas>
  );
}
