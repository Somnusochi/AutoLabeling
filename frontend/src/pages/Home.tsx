

export function Home() {
  const {
    appMode, setAppMode,
    validateModelSource, setValidateModelSource,
    selectedTrainedJobId, setSelectedTrainedJobId,
    inputMode, setInputMode,
    files, setFiles,
    previewUrl, setPreviewUrl,
    categories, setCategories,
    validateVideoId, setValidateVideoId,
    validateRunKey, setValidateRunKey,
    externalModelFile, setExternalModelFile,
    result, setResult,
    batchResults, setBatchResults,
    batchProgress,
    validateConf, setValidateConf,
    validateIou, setValidateIou,
    canvasMode, setCanvasMode,
    drawCategory, setDrawCategory,
    hiddenIndices,
    filterMode, setFilterMode,
    nmsIou, setNmsIou,
    elapsedMs,
    historyData, recentCategories,
    handleFiles, handleDetect, handleSelectHistory, handleReDetect,
    handleDrawBox, handleDeleteBox, handleSelectKeyframe, handleBatchSelect,
    loading, displayResult, toggleBoxVisibility, handleSaveBoxes, cancelBatch,
    setHiddenIndices
  } = useHomeState();

  return (
    <>
      <aside
        className="flex-shrink-0 border-r border-gray-200 bg-white flex flex-col gap-4 overflow-y-auto relative"
        style={{ width: 420, padding: "1rem" }}
      >
        {/* Mode tabs */}
        <div className="flex gap-1 rounded bg-gray-100 p-0.5">
          {(["annotate", "validate"] as const).map((m) => (
            <button key={m} onClick={() => { setAppMode(m); setResult(null); setValidateVideoId(null); }}
              className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                appMode === m ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {{ annotate: "标注预训练", validate: "YOLO 验证" }[m]}
            </button>
          ))}
        </div>

        {appMode === "validate" && (
          <ValidationSettings
            selectedJobId={selectedTrainedJobId}
            onSelectJob={setSelectedTrainedJobId}
            modelSource={validateModelSource}
            onSourceChange={setValidateModelSource}
            externalFile={externalModelFile}
            onExternalFile={setExternalModelFile}
            validateConf={validateConf}
            onConfChange={setValidateConf}
            validateIou={validateIou}
            onIouChange={setValidateIou}
          />
        )}

        <div>
          <div className="flex gap-1 rounded bg-gray-100 p-0.5 mb-2">
            {(["image", "video"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => { setInputMode(mode); setFiles([]); setPreviewUrl(null); setBatchResults([]); }}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  inputMode === mode
                    ? "bg-white text-primary-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {{ image: "图片", video: "视频" }[mode]}
              </button>
            ))}
          </div>
          {inputMode === "image" ? (
            <ImageUploader onFiles={handleFiles} disabled={loading} />
          ) : (
            <VideoPanel
              onLoadKeyframes={handleSelectKeyframe}
              onValidateVideo={appMode === "validate" ? (videoId) => { setValidateVideoId(videoId); setValidateRunKey((k) => k + 1); } : undefined}
              disabled={loading}
            />
          )}
        </div>

        {!(appMode === "validate" && inputMode === "video" && validateVideoId) && (
          <>
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">目标类别</p>
              <CategoryInput categories={categories} onChange={setCategories} disabled={loading} recentCategories={recentCategories} />
            </div>

            <button
              type="button"
              disabled={loading || files.length === 0 || (appMode !== "validate" && categories.length === 0)}
              onClick={handleDetect}
              className="w-full rounded bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading
                ? <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    检测中 {batchProgress.total > 1 ? `(${batchProgress.current}/${batchProgress.total})` : "..."}
                  </span>
                : appMode === "validate" ? "YOLO 验证" : `开始检测${files.length > 1 ? ` (${files.length} 张)` : ""}`}
            </button>
          </>
        )}

        {appMode === "validate" && inputMode === "video" && (
          <div className="text-xs text-gray-400 text-center py-2">
            {validateVideoId ? '视频推理中，调整上方 Conf/IoU 后重新点击「验证视频」' : '选择一个视频，展开后点击「验证视频」'}
          </div>
        )}

        <BatchProgress current={batchProgress.current} total={batchProgress.total} completed={batchResults.length}
          onCancel={cancelBatch} />

        {result && (
          <FilterPanel
            filterMode={filterMode}
            onFilterModeChange={setFilterMode}
            nmsIou={nmsIou}
            onNmsIouChange={setNmsIou}
            setHiddenIndices={setHiddenIndices}
          />
        )}

        <hr className="border-gray-100" />

        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">历史记录</p>
          <Suspense fallback={<HistorySkeleton />}>
            <ErrorBoundary>
              <HistoryList data={historyData} onSelect={handleSelectHistory} />
            </ErrorBoundary>
          </Suspense>
        </div>

        <hr className="border-gray-100" />

        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">YOLO 训练</p>
          <TrainingPanel detections={historyData?.items ?? []} />
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto p-6">
        {validateVideoId && appMode === "validate" && (
          <VideoValidator
            key={validateRunKey}
            videoId={validateVideoId}
            jobId={validateModelSource === "trained" ? (selectedTrainedJobId ?? undefined) : undefined}
            modelFile={validateModelSource === "upload" ? (externalModelFile ?? undefined) : undefined}
            conf={validateConf}
            iou={validateIou}
          />
        )}

        {!validateVideoId && !result && !loading && (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
            上传图片/视频并输入目标类别，点击"开始检测"
          </div>
        )}
        {loading && !result && <DetectionSkeleton />}
        {displayResult && previewUrl && (
          <ErrorBoundary>
            <DetectionResult
              result={displayResult} previewUrl={previewUrl}
              batchResults={batchResults} batchFiles={files} loading={loading} elapsedMs={elapsedMs}
              categories={categories} canvasMode={canvasMode} drawCategory={drawCategory}
              recentCategories={recentCategories} hiddenIndices={hiddenIndices}
              onToggleVisibility={toggleBoxVisibility} isValidation={appMode === "validate"}
              onCanvasModeChange={setCanvasMode} onDrawCategoryChange={setDrawCategory}
              onDeleteBox={handleDeleteBox} onSelectBatch={handleBatchSelect}
              onReDetect={handleReDetect} onSaveBoxes={handleSaveBoxes} onDrawBox={handleDrawBox}
            />
          </ErrorBoundary>
        )}
      </main>
    </>
  );
}
