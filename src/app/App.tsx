import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { CollageEditor } from "../features/editor/CollageEditor";
import { SortablePhotoGrid } from "../features/upload/SortablePhotoGrid";
import { MAX_PHOTOS, validateFiles } from "../features/upload/validateFiles";
import { forgetPhoto, initialHistory, recordEdit, undoEdit } from "../features/editor/collageHistory";
import type { CollageEdit } from "../features/editor/collageHistory";
import { Button } from "../shared/ui/Button";
import { Icon } from "../shared/ui/Icon";
import { Notice } from "../shared/ui/Notice";
import { PanelHeader } from "../shared/ui/PanelHeader";
import { WorkflowSteps } from "../shared/ui/WorkflowSteps";
import styles from "./App.module.css";

type PhotoPreview = { id: string; name: string; url: string; local: boolean; image?: HTMLImageElement };
const samples = [
  { name: "캔버스 가방", url: "/samples/bag.svg" },
  { name: "책상 위 소품", url: "/samples/desk.svg" },
  { name: "라탄 바구니", url: "/samples/basket.svg" },
  { name: "작은 화분", url: "/samples/plant.svg" },
];

export function App() {
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"select" | "edit" | "export">("select");
  const [history, setHistory] = useState(initialHistory);
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const activeUrls = useRef(new Set<string>());
  const dragDepth = useRef(0);
  const hintId = useId();
  const stepLabel = { select: "사진 선택", edit: "사진 배치", export: "저장" }[step];

  useEffect(() => {
    const urls = activeUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  function editCollage(edit: CollageEdit, group?: symbol) {
    setHistory((current) => recordEdit(current, edit, group));
  }

  function release(photo: PhotoPreview) {
    if (photo.local) {
      URL.revokeObjectURL(photo.url);
      activeUrls.current.delete(photo.url);
    }
  }

  async function importFiles(files: File[], replacement?: PhotoPreview) {
    if (!files.length || loadingRef.current) return;
    const issue = validateFiles(files, photos.length - (replacement ? 1 : 0));
    if (issue) {
      setError(issue);
      setMessage("");
      return;
    }
    const next = files.map((file) => {
      const url = URL.createObjectURL(file);
      activeUrls.current.add(url);
      return { id: crypto.randomUUID(), name: file.name, url, local: true };
    });
    loadingRef.current = true;
    setLoading(true);
    setError("");
    setMessage("사진을 불러오는 중이에요.");

    const results = await Promise.allSettled(next.map(async (photo) => {
      const image = new Image();
      image.src = photo.url;
      await image.decode();
      return { ...photo, image };
    }));
    if (!next.some((photo) => activeUrls.current.has(photo.url))) return;

    const ready: PhotoPreview[] = [];
    const failed: PhotoPreview[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") ready.push(result.value);
      else failed.push(next[index]);
    });
    failed.forEach(release);

    if (replacement && ready.length) {
      setPhotos((current) => current.map((photo) => photo.id === replacement.id ? ready[0] : photo));
      setHistory((current) => forgetPhoto(current, replacement.id));
      release(replacement);
    } else if (ready.length) {
      setPhotos((current) => [...current, ...ready]);
    }

    if (failed.length) {
      setError(`사진 ${failed.length}장을 열 수 없어요. 파일을 확인하거나 다른 사진을 선택해 주세요.`);
    }
    setMessage(ready.length ? (replacement ? "사진을 교체했어요." : "사진을 추가했어요.") : "");
    loadingRef.current = false;
    setLoading(false);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void importFiles(Array.from(event.currentTarget.files ?? []));
    event.currentTarget.value = "";
  }

  function onReplacementChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    const replacement = photos.find((photo) => photo.id === replaceId.current);
    replaceId.current = null;
    event.currentTarget.value = "";
    if (file && replacement) void importFiles([file], replacement);
  }

  function movePhoto(id: string, targetId: string) {
    if (loadingRef.current) return;
    const index = photos.findIndex((photo) => photo.id === id);
    const destination = photos.findIndex((photo) => photo.id === targetId);
    if (index < 0 || destination < 0 || index === destination) return;

    setPhotos(arrayMove(photos, index, destination));
    setError("");
    setMessage(`${photos[index].name} 사진을 ${destination + 1}번째로 옮겼어요.`);
  }

  function loadSamples() {
    if (photos.length || loadingRef.current) return;
    setPhotos(
      samples.map((sample) => ({
        ...sample,
        id: crypto.randomUUID(),
        local: false,
      })),
    );
    setError("");
    setMessage("샘플 일러스트를 불러왔어요.");
  }

  function removePhoto(id: string) {
    if (loadingRef.current) return;
    const photo = photos.find((photo) => photo.id === id);
    if (!photo) return;
    release(photo);
    setPhotos((current) => current.filter((photo) => photo.id !== id));
    setHistory((current) => photos.length === 1 ? initialHistory : forgetPhoto(current, id));
    setMessage("선택한 사진을 제거했어요.");
    setError("");
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void importFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div className={styles.app}>
      <a href="#main" className={styles.skipLink}>
        본문으로 이동
      </a>
      <header className={styles.header}>
        <a href="/" className={styles.logo} aria-label="Snaproom 홈">
          <span className={styles.logoMark} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          snaproom
        </a>
        <span className={styles.documentName}>
          새 이미지<span>/</span>
          <span>{stepLabel}</span>
        </span>
        <span className={styles.privacy}>
          <Icon name="lock" /> 로컬 작업
        </span>
      </header>
      <div className={styles.workbench}>
        <aside className={styles.sidebar} aria-label="파일 패널">
          <PanelHeader title="파일">{photos.length} / 4</PanelHeader>
          <Button
            className={styles.addFiles}
            onClick={() => fileInput.current?.click()}
            disabled={step !== "select" || loading || photos.length >= MAX_PHOTOS}
          >
            <Icon name="plus" /> 사진 추가
          </Button>
          {photos.length ? (
            <ul className={styles.assetList}>
              {photos.map((photo, index) => (
                <li key={photo.id}>
                  <span className={styles.assetIndex}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.assetName}>{photo.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyFiles}>
              추가한 사진이 여기에 표시됩니다.
            </p>
          )}
          <div className={styles.sidebarNote}>
            <span>사진 불러오기</span>
            <p>
              사진을 선택하거나
              <br />
              작업 영역에 끌어 놓으세요.
            </p>
          </div>
        </aside>
        <main id="main" className={styles.main}>
          <div className={styles.workspaceBar}>
            <WorkflowSteps current={step} />
            <span className={styles.workspaceLabel}>작업 영역</span>
          </div>
          <div className={styles.workspaceContent} hidden={step !== "select"}>
            <div className={styles.intro}>
              <h1>사진 가져오기</h1>
              <p className={styles.description}>
                함께 배치할 사진을 최대 4장 선택하세요.
              </p>
            </div>
            <section
              className={`${styles.dropzone} ${dragging ? styles.dragging : ""}`}
              aria-labelledby="upload-heading"
              onDragEnter={(event) => {
                event.preventDefault();
                dragDepth.current += 1;
                if (!loadingRef.current) setDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = loadingRef.current ? "none" : "copy";
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                dragDepth.current -= 1;
                if (dragDepth.current <= 0) {
                  dragDepth.current = 0;
                  setDragging(false);
                }
              }}
              onDrop={onDrop}
            >
              <span className={styles.uploadIcon}>
                <Icon name="image" size="large" />
              </span>
              <h2 id="upload-heading">사진을 여기에 끌어 놓으세요</h2>
              <p>또는 파일을 선택해 추가하세요.</p>
              <input
                ref={fileInput}
                id="photo-files"
                className={styles.fileInput}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={onFileChange}
                aria-label="사진 파일 선택"
                aria-describedby={hintId}
                tabIndex={-1}
              />
              <Button
                variant="primary"
                className={styles.primaryButton}
                onClick={() => fileInput.current?.click()}
                disabled={loading || photos.length >= MAX_PHOTOS}
              >
                사진 선택하기
              </Button>
              <p id={hintId} className={styles.fileHint}>
                JPG · PNG · WebP &nbsp; / &nbsp; 최대 4장 &nbsp; / &nbsp; 장당
                20MB
              </p>
            </section>
            <input
              ref={replaceInput}
              className={styles.fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="교체할 사진 파일 선택"
              onChange={onReplacementChange}
            />
            <div className={styles.sampleRow}>
              <Button
                variant="ghost"
                onClick={loadSamples}
                disabled={loading || photos.length > 0}
              >
                샘플 일러스트로 둘러보기
              </Button>
            </div>
            {error && <Notice>{error}</Notice>}
            <p className={styles.liveStatus} role="status" aria-label="사진 선택 상태">
              {loading ? message : message && `${message} 현재 ${photos.length}장이 선택되어 있어요.`}
            </p>
            {photos.length > 0 && (
              <section
                className={styles.selection}
                aria-labelledby="selected-heading"
              >
                <div className={styles.selectionHeader}>
                  <h2 id="selected-heading">
                    선택한 사진 <span>{photos.length} / 4</span>
                  </h2>
                  <Button
                    variant="ghost"
                    disabled={loading}
                    onClick={() => {
                      if (loadingRef.current) return;
                      photos.forEach(release);
                      setPhotos([]);
                      setHistory(initialHistory);
                      setError("");
                      setMessage("선택한 사진을 모두 비웠어요.");
                    }}
                  >
                    모두 비우기
                  </Button>
                </div>
                <SortablePhotoGrid photos={photos} loading={loading} onReorder={movePhoto} onRemove={removePhoto}
                  onReplace={(id) => {
                    replaceId.current = id;
                    replaceInput.current?.click();
                  }} />
                <p className={styles.selectionHint}>
                  {photos.length > 1 && <>사진 카드를 끌어서 순서를 바꿀 수 있어요. 터치 화면에서는 잠깐 눌렀다가 끌어 주세요. <br /></>}
                  선택한 사진은 새로고침하면 사라져요.
                </p>
                <div className={styles.selectionActions}>
                  <Button variant="primary" disabled={loading} onClick={() => setStep("edit")}>사진 배치 시작</Button>
                </div>
              </section>
            )}
          </div>
          {step !== "select" && (
            <div className={styles.workspaceContent}>
              <CollageEditor
                photos={photos}
                document={history.document}
                canUndo={history.past.length > 0}
                onEdit={editCollage}
                onUndo={() => setHistory(undoEdit)}
                onSelect={() => setStep("select")}
                onExport={(exporting) => setStep(exporting ? "export" : "edit")}
              />
            </div>
          )}
        </main>
        <aside className={styles.inspector} aria-label="가져오기 안내">
          <PanelHeader title="가져오기" />
          <section className={styles.infoSection}>
            <h3>파일 안내</h3>
            <dl>
              <div>
                <dt>형식</dt>
                <dd>JPG, PNG, WebP</dd>
              </div>
              <div>
                <dt>최대 개수</dt>
                <dd>4장</dd>
              </div>
              <div>
                <dt>파일 크기</dt>
                <dd>장당 20MB</dd>
              </div>
            </dl>
          </section>
          <section className={styles.infoSection}>
            <h3>개인정보 보호</h3>
            <p>사진은 브라우저 안에서 처리하며 서버에 업로드하지 않습니다.</p>
            <p>새로고침하면 선택한 사진이 사라집니다.</p>
          </section>
        </aside>
      </div>
      <footer className={styles.footer}>
        <span>{stepLabel}</span>
        <span>
          {photos.length}장 선택됨
          <span className={styles.footerDivider}>·</span>기기 내 처리
        </span>
      </footer>
    </div>
  );
}
