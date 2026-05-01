import { useState, useEffect } from 'react';

export function useGithubToken() {
  const [token, setToken] = useState<string>(() => {
    return localStorage.getItem('github_pat') || '';
  });

  const updateToken = (newToken: string) => {
    setToken(newToken);
    if (newToken) {
      localStorage.setItem('github_pat', newToken);
    } else {
      localStorage.removeItem('github_pat');
    }
  };

  return { token, setToken: updateToken };
}
