import React from 'react';
import { UserProfile, GradeConfig, getUserGrade } from '../types';

interface Props {
  user: UserProfile | null | undefined;
  gradeConfigs: GradeConfig[];
  size?: 'sm' | 'md';
  className?: string;
}

const GradeBadge: React.FC<Props> = ({ user, gradeConfigs, size = 'sm', className = '' }) => {
  const grade = getUserGrade(user, gradeConfigs);
  if (!grade) return null;
  const sizeClass = size === 'sm' ? 'text-[10px] px-2.5 py-0.5' : 'text-xs px-3 py-1';
  return (
    <span className={`${grade.color} text-white font-black rounded-full italic uppercase tracking-wider ${sizeClass} ${className}`}>
      {grade.name}
    </span>
  );
};

export default GradeBadge;
