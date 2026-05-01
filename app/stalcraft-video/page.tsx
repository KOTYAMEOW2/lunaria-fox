import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getStalcraftProfile, listVisibleStalcraftVideos } from "@/lib/stalcraft/data";

export const dynamic = "force-dynamic";

function hostFromUrl(url: string | null) {
  if (!url) return "video";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "video"; }
}

export default async function StalcraftVideoPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/discord/login");

  const profile = await getStalcraftProfile(session.userId).catch(() => null);
  if (!profile?.selected_character_id) {
    return (
      <section className="page-shell">
        <div className="container">
          <div className="page-head">
            <span className="eyebrow">STALCRAFT Video</span>
            <h1>Раздел доступен после привязки персонажа</h1>
            <p>Авторизуйся через EXBO и выбери персонажа STALCRAFT, чтобы видеть видео комьюнити.</p>
          </div>
          <a className="primary-button" href="/stalcraft">Привязать STALCRAFT</a>
        </div>
      </section>
    );
  }

  const videos = await listVisibleStalcraftVideos(session.userId);

  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-head">
          <span className="eyebrow">STALCRAFT Video</span>
          <h1>Видео STALCRAFT-комьюнити</h1>
          <p>Публикация идёт через команду `/sc-video` в Discord. Видят раздел только пользователи с привязанным персонажем.</p>
        </div>

        <div className="command-grid">
          {videos.length > 0 ? videos.map((video) => (
            <article className="command-card" key={video.id}>
              <span className="eyebrow">{video.region || "SC"} · {video.character_name || video.author_name || "unknown"}</span>
              <h3>{video.title}</h3>
              <p>{video.description || "Без описания."}</p>
              {video.video_url ? <a className="secondary-button" href={video.video_url} target="_blank" rel="noreferrer" style={{ marginTop: 14 }}>Открыть на {hostFromUrl(video.video_url)}</a> : null}
            </article>
          )) : (
            <article className="panel">
              <h3>Пока нет видео</h3>
              <p>Когда участники опубликуют видео через `/sc-video`, они появятся здесь.</p>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
