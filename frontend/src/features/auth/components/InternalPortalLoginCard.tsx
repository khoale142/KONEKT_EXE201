import type { FormEventHandler, ReactNode } from "react";

type InternalPortalLoginCardProps = {
  error?: string;
  footer: ReactNode;
  onPasswordChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onUsernameChange: (value: string) => void;
  password: string;
  subtitle: ReactNode;
  submitLabel: string;
  title: string;
  username: string;
  usernamePlaceholder: string;
};

export default function InternalPortalLoginCard({
  error,
  footer,
  onPasswordChange,
  onSubmit,
  onUsernameChange,
  password,
  subtitle,
  submitLabel,
  title,
  username,
  usernamePlaceholder,
}: InternalPortalLoginCardProps) {
  return (
    <div className="cafe-page">
      <div className="cafe-card" style={{ padding: 32 }}>
        <h1 className="cafe-title">{title}</h1>
        <p className="cafe-subtitle">{subtitle}</p>

        <form onSubmit={onSubmit} className="cafe-form">
          <div>
            <label className="cafe-label">
              Tên đăng nhập <span className="required">*</span>
            </label>
            <input
              className="cafe-input"
              type="text"
              placeholder={usernamePlaceholder}
              autoComplete="username"
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
            />
          </div>

          <div>
            <label className="cafe-label">
              Mật khẩu <span className="required">*</span>
            </label>
            <input
              className="cafe-input"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
            />
          </div>

          <button type="submit" className="cafe-btn-primary" style={{ width: "100%" }}>
            {submitLabel}
          </button>

          {footer}

          {error ? (
            <p className="cafe-error" style={{ marginTop: 8 }}>
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
