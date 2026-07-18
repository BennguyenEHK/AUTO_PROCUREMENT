"use client";

import { useEffect, useState } from "react";
import { Save, UserPlus } from "lucide-react";
import { saveSignup } from "@/app/actions/signup";

interface SignupState {
  signup: boolean;
  user_id: number | null;
  company_id: number | null;
  username?: string;
  company_name?: string;
}

export function SignupPanel() {
  const [state, setState] = useState<SignupState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState({
    company_name: "",
    company_number: "",
    company_address: "",
    company_fax: "",
    company_email: ""
  });
  const [user, setUser] = useState({
    username: "",
    full_name: "",
    email: "",
    user_role: "user"
  });

  async function loadState() {
    const response = await fetch("/api/signup", { cache: "no-store" });
    setState(await response.json());
  }

  useEffect(() => {
    loadState();
  }, []);

  async function submitSignup() {
    setSaving(true);
    setMessage(null);
    try {
      const payload = await saveSignup({ company, user });
      if (!payload.success) throw new Error(payload.error || "Signup failed.");
      setState(payload.state);
      setMessage(`Signup saved. user_id=${payload.state.user_id}, company_id=${payload.state.company_id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Signup failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <strong>Signup</strong>
          <p className="doc-subtitle">Create the company/user records and update the local signup state automatically.</p>
        </div>
        <span className="badge">{state?.signup ? `Active: ${state.user_id}/${state.company_id}` : "Not active"}</span>
      </div>
      <div className="panel-body stack">
        {message ? <div className={message.toLowerCase().includes("failed") ? "notice error" : "notice"}>{message}</div> : null}
        <section className="grid">
          <div className="stack">
            <div className="section-label">Company</div>
            <input placeholder="Company name" value={company.company_name} onChange={(event) => setCompany({ ...company, company_name: event.target.value })} />
            <input placeholder="Company number" value={company.company_number} onChange={(event) => setCompany({ ...company, company_number: event.target.value })} />
            <input placeholder="Company email" value={company.company_email} onChange={(event) => setCompany({ ...company, company_email: event.target.value })} />
            <input placeholder="Company fax" value={company.company_fax} onChange={(event) => setCompany({ ...company, company_fax: event.target.value })} />
            <textarea placeholder="Company address" value={company.company_address} onChange={(event) => setCompany({ ...company, company_address: event.target.value })} />
          </div>
          <div className="stack">
            <div className="section-label">User</div>
            <input placeholder="Username" value={user.username} onChange={(event) => setUser({ ...user, username: event.target.value })} />
            <input placeholder="Full name" value={user.full_name} onChange={(event) => setUser({ ...user, full_name: event.target.value })} />
            <input placeholder="User email" value={user.email} onChange={(event) => setUser({ ...user, email: event.target.value })} />
            <select value={user.user_role} onChange={(event) => setUser({ ...user, user_role: event.target.value })}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="procurement">Procurement</option>
            </select>
          </div>
        </section>
        <div className="actions">
          <button className="primary" onClick={submitSignup} disabled={saving}>
            <UserPlus size={16} /> Create and save
          </button>
          <button className="secondary" onClick={loadState}>
            <Save size={16} /> Reload state
          </button>
        </div>
      </div>
    </section>
  );
}
