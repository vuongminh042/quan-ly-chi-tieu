import { useEffect, useState, type ChangeEvent } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Camera,
  Check,
  Eye,
  Plus,
  Trash2,
  Tags,
  ShieldCheck,
  X,
} from "lucide-react";
import { get, post, put, del } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Category, User } from "../types";
import {
  Button,
  CategoryIcon,
  EmptyState,
  PageTitle,
  Panel,
} from "../components/UI";
import type { AppOutlet } from "../components/AppShell";
import { useConfirm } from "../components/ConfirmDialog";

type AvatarSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  publicId: string;
  transformation: string;
  signature: string;
};
export default function Settings() {
  const { user, setUser, demo } = useAuth();
  const { notify } = useOutletContext<AppOutlet>();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(user?.avatar);
  const [avatarPreview, setAvatarPreview] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState("");
  const [deactivating, setDeactivating] = useState(false);
  const [newName, setNewName] = useState("");
  const [kind, setKind] = useState<"expense" | "income">("expense");
  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(user?.avatar);
      return;
    }
    const previewUrl = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [avatarFile, user?.avatar]);
  useEffect(() => {
    setName(user?.name ?? "");
    void get<{ items: Category[] }>("/categories")
      .then((x) => setCategories(x.items))
      .catch(() => {});
  }, [user?.name]);
  useEffect(() => {
    if (!avatarPreview) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAvatarPreview(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [avatarPreview]);
  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    let uploadedPublicId: string | undefined;
    try {
      let avatarFields: { avatar?: string; avatarPublicId?: string } = {};
      const legacyAvatar = user?.avatar?.startsWith("data:image/")
        ? await (await fetch(user.avatar)).blob()
        : null;
      const imageToSave = avatarFile ?? legacyAvatar;
      if (imageToSave) {
        setAvatarBusy(true);
        const uploaded = await uploadAvatar(imageToSave);
        avatarFields = uploaded;
        uploadedPublicId = uploaded.avatarPublicId;
      }
      const result = await put<{ user: User; warning?: string }>("/profile", {
        name,
        ...avatarFields,
      });
      setUser(result.user);
      setAvatarFile(null);
      notify(result.warning ?? "Đã cập nhật hồ sơ.");
    } catch (err: any) {
      if (uploadedPublicId && !demo) {
        try {
          await post("/profile/avatar-discard", { publicId: uploadedPublicId });
        } catch (cleanupError) {
          console.error("Không thể dọn ảnh tải lên chưa lưu:", cleanupError);
        }
      }
      notify(err?.response?.data?.error ?? "Không thể cập nhật hồ sơ.");
    } finally {
      setAvatarBusy(false);
      setSaving(false);
    }
  }
  async function deactivateAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeactivating(true);
    try {
      await post("/profile/deactivate", { password: deactivatePassword });
      setUser(null);
      navigate("/login", { replace: true });
      notify(
        "Tài khoản đã bị vô hiệu hóa. Hãy liên hệ quản trị viên nếu cần khôi phục.",
      );
    } catch (err: any) {
      notify(err?.response?.data?.error ?? "Không thể vô hiệu hóa tài khoản.");
    } finally {
      setDeactivating(false);
    }
  }
  async function uploadAvatar(image: Blob) {
    if (image.size > 8 * 1024 * 1024) throw new Error("Ảnh cần nhỏ hơn 8 MB.");
    const bitmap = await createImageBitmap(image);
    if (bitmap.width * bitmap.height > 40_000_000) {
      bitmap.close();
      throw new Error("Kích thước ảnh quá lớn.");
    }
    bitmap.close();
    if (demo) {
      const previewBitmap = await createImageBitmap(image);
      const canvas = document.createElement("canvas");
      const scale = Math.min(
        1,
        512 / Math.max(previewBitmap.width, previewBitmap.height),
      );
      canvas.width = Math.max(1, Math.round(previewBitmap.width * scale));
      canvas.height = Math.max(1, Math.round(previewBitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        previewBitmap.close();
        throw new Error("Không thể xử lý ảnh.");
      }
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(previewBitmap, 0, 0, canvas.width, canvas.height);
      previewBitmap.close();
      const avatar = canvas.toDataURL("image/jpeg", 0.82);
      if (avatar.length > 180_000)
        throw new Error("Ảnh quá lớn để lưu trong chế độ xem thử.");
      return { avatar };
    }
    const signature = await post<AvatarSignature>("/profile/avatar-signature");
    const form = new FormData();
    form.append("file", image, "avatar.jpg");
    form.append("api_key", signature.apiKey);
    form.append("timestamp", String(signature.timestamp));
    form.append("public_id", signature.publicId);
    form.append("overwrite", "false");
    form.append("transformation", signature.transformation);
    form.append("signature", signature.signature);
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/image/upload`,
      { method: "POST", body: form },
    );
    const upload = (await response.json()) as {
      secure_url?: string;
      public_id?: string;
      error?: { message?: string };
    };
    if (!response.ok || !upload.secure_url || !upload.public_id)
      throw new Error(
        upload.error?.message ?? "Không thể tải ảnh lên Cloudinary.",
      );
    if (upload.public_id !== signature.publicId)
      throw new Error("Cloudinary trả về mã ảnh không hợp lệ.");
    return { avatar: upload.secure_url, avatarPublicId: upload.public_id };
  }
  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      notify("Vui lòng chọn ảnh JPG, PNG hoặc WebP.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      notify("Ảnh cần nhỏ hơn 8 MB.");
      return;
    }
    setAvatarFile(file);
  }
  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    try {
      const color = kind === "expense" ? "#e78b72" : "#087f6a";
      await post("/categories", { name: newName, kind, icon: "circle", color });
      setNewName("");
      const r = await get<{ items: Category[] }>("/categories");
      setCategories(r.items);
      notify("Đã thêm danh mục.");
    } catch (err: any) {
      notify(err?.response?.data?.error ?? "Không thể thêm danh mục.");
    }
  }
  async function removeCategory(id: string) {
    if (
      !(await confirm({
        title: "Xóa danh mục?",
        message:
          "Danh mục đang được giao dịch hoặc ngân sách sử dụng sẽ không thể xóa.",
      }))
    )
      return;
    try {
      await del(`/categories/${id}`);
      setCategories((x) => x.filter((c) => c._id !== id));
      notify("Đã xóa danh mục.");
    } catch (err: any) {
      notify(err?.response?.data?.error ?? "Không thể xóa danh mục.");
    }
  }
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="CÁ NHÂN HÓA TRẢI NGHIỆM"
        title="Cài đặt."
        description="Quản lý hồ sơ, danh mục và thông tin riêng tư của bạn."
      />
      <div className="settings-grid">
        <div className="settings-main">
          {" "}
          <Panel title="Hồ sơ cá nhân" className="settings-profile">
            <div className="settings-user-intro">
              <button
                type="button"
                className="settings-avatar settings-avatar-button"
                onClick={() => avatarPreviewUrl && setAvatarPreview(true)}
                disabled={!avatarPreviewUrl}
                aria-label="Xem trước ảnh đại diện"
                title={
                  avatarPreviewUrl ? "Xem ảnh đại diện" : "Chưa có ảnh đại diện"
                }
              >
                {avatarPreviewUrl ? (
                  <>
                    <img src={avatarPreviewUrl} alt="Ảnh đại diện" />
                    <span className="avatar-preview-hint">
                      <Eye size={15} />
                      <small>Preview</small>
                    </span>
                  </>
                ) : (
                  name.slice(0, 1).toUpperCase() || "L"
                )}
              </button>
              <span>
                <strong>{user?.name}</strong>
                <small>{user?.email}</small>
              </span>
              <label
                className="button button-secondary"
                style={{
                  marginLeft: "auto",
                  opacity: avatarBusy ? 0.6 : 1,
                  cursor: avatarBusy ? "wait" : "pointer",
                }}
              >
                <Camera size={15} />
                {avatarBusy ? "Đang tải…" : "Tải ảnh"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Tải ảnh đại diện"
                  disabled={avatarBusy}
                  onChange={handleAvatarChange}
                  style={{ display: "none" }}
                />
              </label>
            </div>
            <form className="form-stack settings-form" onSubmit={saveProfile}>
              <label>
                Tên hiển thị
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <label>
                Email
                <input value={user?.email ?? ""} disabled />
              </label>
              <div>
                <Button type="submit" disabled={saving}>
                  <Check size={16} />
                  {saving ? "Đang lưu…" : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </Panel>
          {!demo && (
            <Panel
              title="Vô hiệu hóa tài khoản"
              className="settings-deactivate"
            >
              <p>
                Tài khoản sẽ không thể đăng nhập. Dữ liệu của bạn được giữ lại
                và chỉ quản trị viên mới có thể khôi phục.
              </p>
              <Button
                type="button"
                variant="danger"
                onClick={() => setShowDeactivate(true)}
              >
                Vô hiệu hóa tài khoản
              </Button>
            </Panel>
          )}
          <Panel
            title="Danh mục thu chi"
            action={
              <span className="settings-count">
                {categories.length} danh mục
              </span>
            }
          >
            <div className="settings-category-groups">
              {(["expense", "income"] as const).map((k) => {
                const items = categories.filter((c) => c.kind === k);
                return (
                  <div className="settings-category-group" key={k}>
                    <div className="category-group-title">
                      {k === "expense" ? "Danh mục chi" : "Danh mục thu"}{" "}
                      <span>{items.length}</span>
                    </div>
                    {items.length ? (
                      items.map((c) => (
                        <div className="settings-category-row" key={c._id}>
                          <span
                            className="category-color-dot"
                            style={{ background: c.color }}
                          />
                          <CategoryIcon name={c.icon} size={15} />
                          <strong>{c.name}</strong>
                          {c.isDefault && <small>Mặc định</small>}
                          <button
                            className="icon-button subtle-delete"
                            onClick={() => void removeCategory(c._id)}
                            title="Xóa danh mục"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <EmptyState
                        title="Chưa có danh mục"
                        hint="Thêm danh mục mới ở phía dưới."
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <form className="category-add-form" onSubmit={addCategory}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tên danh mục mới"
                maxLength={60}
                required
              />
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                <option value="expense">Khoản chi</option>
                <option value="income">Khoản thu</option>
              </select>
              <Button type="submit" variant="secondary">
                <Plus size={15} /> Thêm
              </Button>
            </form>
          </Panel>
        </div>
        <div className="settings-aside">
          <Panel className="privacy-card">
            <div className="privacy-mark">
              <ShieldCheck size={20} />
            </div>
            <h2>Dữ liệu thuộc về bạn.</h2>
            <p>
              Giao dịch, ngân sách và mục tiêu luôn được lọc theo tài khoản đang
              đăng nhập.
            </p>
            <div className="privacy-divider" />
            <div>
              <span>Phiên đăng nhập</span>
              <strong>HttpOnly cookie · 7 ngày</strong>
            </div>
            <div>
              <span>Chế độ dữ liệu</span>
              <strong>
                {demo ? "Xem thử trên trình duyệt" : "MongoDB cá nhân"}
              </strong>
            </div>
          </Panel>
          <Panel className="settings-about">
            <span className="about-mark">
              <Tags size={17} />
            </span>
            <strong>Chi Tiêu</strong>
            <p>Rõ từng đồng, nhẹ đầu mỗi tháng.</p>
            <small>Phiên bản 1.0 · MERN Stack</small>
          </Panel>
        </div>
      </div>
      {avatarPreview && avatarPreviewUrl && (
        <div
          className="avatar-preview-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAvatarPreview(false);
          }}
        >
          <section
            className="avatar-preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Xem trước ảnh đại diện"
          >
            <button
              type="button"
              className="icon-button avatar-preview-close"
              onClick={() => setAvatarPreview(false)}
              aria-label="Đóng xem trước"
            >
              <X size={19} />
            </button>
            <img
              src={avatarPreviewUrl}
              alt={`Ảnh đại diện của ${user?.name}`}
            />
          </section>
        </div>
      )}
      {showDeactivate && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deactivating)
              setShowDeactivate(false);
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-title"
          >
            <div className="modal-head">
              <div>
                <span className="eyebrow">BẢO VỆ TÀI KHOẢN</span>
                <h2 id="deactivate-title">Vô hiệu hóa tài khoản?</h2>
              </div>
              <button
                className="icon-button"
                onClick={() => setShowDeactivate(false)}
                aria-label="Đóng"
                disabled={deactivating}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={deactivateAccount} className="form-stack">
              <p>
                Bạn sẽ bị đăng xuất. Dữ liệu được giữ lại; muốn khôi phục, vui
                lòng liên hệ quản trị viên.
              </p>
              <label>
                Nhập mật khẩu để xác nhận
                <input
                  type="password"
                  autoComplete="current-password"
                  value={deactivatePassword}
                  onChange={(event) =>
                    setDeactivatePassword(event.target.value)
                  }
                  required
                  maxLength={128}
                />
              </label>
              <div className="modal-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowDeactivate(false)}
                  disabled={deactivating}
                >
                  Hủy
                </Button>
                <Button type="submit" variant="danger" disabled={deactivating}>
                  {deactivating ? "Đang xử lý…" : "Vô hiệu hóa"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
