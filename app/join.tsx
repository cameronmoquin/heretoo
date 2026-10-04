/** /join — create a member account. See components/nffga/AuthForm.tsx. */
import React from 'react';
import { AuthForm } from '../components/nffga/AuthForm';

export default function Join() {
  return <AuthForm mode="join" />;
}
