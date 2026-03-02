import { DEFAULT_DISPLAY_MODE, formatDuration, resolveDisplayMode, unitLabel } from "./display.js";
import { DEFAULT_JITTER_TYPE, resolveJitterType } from "./backoff.js";

/**
 * @typedef {import("./display.js").DisplayMode} DisplayMode
 * @typedef {import("./backoff.js").ValidationError} ValidationError
 * @typedef {import("./backoff.js").ChartMathExplanationModel} ChartMathExplanationModel
 */

const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
const MATH_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  useGrouping: false,
  maximumFractionDigits: 3,
});
let pendingMathTypesetContainer = null;
let mathTypesetQueue = Promise.resolve();

/**
 * Queue MathJax typesetting so rapid hover updates don't spawn overlapping renders.
 * @param {HTMLElement} container
 */
function queueMathTypeset(container) {
  const mathJax = globalThis.MathJax;
  if (mathJax == null || typeof mathJax.typesetPromise !== "function") {
    return;
  }

  pendingMathTypesetContainer = container;

  mathTypesetQueue = mathTypesetQueue
    .then(async () => {
      if (pendingMathTypesetContainer == null) {
        return;
      }

      const targetContainer = pendingMathTypesetContainer;
      pendingMathTypesetContainer = null;

      if (typeof mathJax.typesetClear === "function") {
        mathJax.typesetClear([targetContainer]);
      }

      await mathJax.typesetPromise([targetContainer]);
    })
    .catch((error) => {
      console.error("MathJax typeset failed.", error);
    });
}

function toNumber(value) {
  if (typeof value !== "string") {
    return Number.NaN;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return Number.NaN;
  }
  return Number(trimmed);
}

function isDigitKey(key) {
  return key.length === 1 && key >= "0" && key <= "9";
}

/**
 * Prevent non-integer input for a numeric field (typing and paste).
 * @param {HTMLInputElement} input
 */
export function enforceNonNegativeIntegerInput(input) {
  input.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const allowedControlKeys = new Set([
      "Backspace",
      "Delete",
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Home",
      "End",
      "Tab",
      "Enter",
    ]);

    if (allowedControlKeys.has(event.key)) {
      return;
    }

    if (!isDigitKey(event.key)) {
      event.preventDefault();
    }
  });

  input.addEventListener("paste", (event) => {
    const pastedText = event.clipboardData?.getData("text") ?? "";
    if (!/^\d+$/.test(pastedText)) {
      event.preventDefault();
    }
  });
}

/**
 * @param {{
 *   strategyInputs: HTMLInputElement[],
 *   initialDelayMs: HTMLInputElement,
 *   maxRetries: HTMLInputElement,
 *   maxDelayMs: HTMLInputElement,
 *   factor: HTMLInputElement,
 *   incrementMs: HTMLInputElement,
 *   jitterInputs: HTMLInputElement[]
 * }} inputs
 */
export function readConfigFromInputs(inputs) {
  const maxDelayRaw = inputs.maxDelayMs.value.trim();
  const strategy = inputs.strategyInputs.find((input) => input.checked)?.value ?? "";
  const jitter = resolveJitterType(inputs.jitterInputs.find((input) => input.checked)?.value);

  return {
    strategy,
    initialDelayMs: toNumber(inputs.initialDelayMs.value),
    maxRetries: toNumber(inputs.maxRetries.value),
    maxDelayMs: maxDelayRaw === "" ? null : toNumber(maxDelayRaw),
    factor: toNumber(inputs.factor.value),
    incrementMs: toNumber(inputs.incrementMs.value),
    jitter,
  };
}

/**
 * @param {"exponential" | "linear" | "fixed"} strategy
 * @param {{factorGroup: HTMLElement, incrementGroup: HTMLElement}} sections
 */
export function setStrategyVisibility(strategy, sections) {
  sections.factorGroup.hidden = strategy !== "exponential";
  sections.incrementGroup.hidden = strategy !== "linear";
}

/**
 * @param {ValidationError[]} errors
 * @param {{
 *   inputs: {
 *     initialDelayMs: HTMLInputElement,
 *     maxRetries: HTMLInputElement,
 *     maxDelayMs: HTMLInputElement,
 *     factor: HTMLInputElement,
 *     incrementMs: HTMLInputElement
 *   },
 *   messages: {
 *     initialDelayMs: HTMLElement,
 *     maxRetries: HTMLElement,
 *     maxDelayMs: HTMLElement,
 *     factor: HTMLElement,
 *     incrementMs: HTMLElement
 *   }
 * }} targets
 */
export function renderValidation(errors, targets) {
  const fieldErrors = {
    initialDelayMs: "",
    maxRetries: "",
    maxDelayMs: "",
    factor: "",
    incrementMs: "",
  };

  for (const error of errors) {
    if (Object.hasOwn(fieldErrors, error.field)) {
      fieldErrors[error.field] = error.message;
    }
  }

  for (const [fieldName, input] of Object.entries(targets.inputs)) {
    const message = fieldErrors[fieldName];
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }

  targets.messages.initialDelayMs.textContent = fieldErrors.initialDelayMs;
  targets.messages.maxRetries.textContent = fieldErrors.maxRetries;
  targets.messages.maxDelayMs.textContent = fieldErrors.maxDelayMs;
  targets.messages.factor.textContent = fieldErrors.factor;
  targets.messages.incrementMs.textContent = fieldErrors.incrementMs;
}

/**
 * @param {HTMLElement} tbody
 * @param {string} message
 */
export function clearScheduleTable(tbody, message) {
  clearScheduleTableForJitter(tbody, message, DEFAULT_JITTER_TYPE);
}

/**
 * @param {HTMLElement} tbody
 * @param {string} message
 * @param {import("./backoff.js").JitterType} jitterType
 */
export function clearScheduleTableForJitter(tbody, message, jitterType = DEFAULT_JITTER_TYPE) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = jitterType === "none" ? 3 : 5;
  cell.className = "placeholder-cell";
  cell.textContent = message;
  row.append(cell);
  tbody.replaceChildren(row);
}

/**
 * @param {Array<{
 *   retry:number,
 *   minDelayMs:number,
 *   expectedDelayMs:number,
 *   maxDelayMs:number,
 *   delayMs:number,
 *   cumulativeDelayMs:number
 * }>} points
 * @param {HTMLElement} tbody
 * @param {DisplayMode} displayMode
 * @param {import("./backoff.js").JitterType} jitterType
 */
export function renderScheduleTable(
  points,
  tbody,
  displayMode = DEFAULT_DISPLAY_MODE,
  jitterType = DEFAULT_JITTER_TYPE,
) {
  if (!points.length) {
    clearScheduleTableForJitter(tbody, "No retries configured.", jitterType);
    return;
  }

  const normalizedMode = resolveDisplayMode(displayMode);
  const normalizedJitter = resolveJitterType(jitterType);

  const rows = points.map((point) => {
    const row = document.createElement("tr");
    const retry = document.createElement("td");
    const cumulativeDelay = document.createElement("td");

    retry.textContent = point.retry.toString();
    cumulativeDelay.textContent = formatDuration(point.cumulativeDelayMs, normalizedMode);

    if (normalizedJitter === "none") {
      const delay = document.createElement("td");
      delay.textContent = formatDuration(point.delayMs, normalizedMode);
      row.append(retry, delay, cumulativeDelay);
      return row;
    }

    const minDelay = document.createElement("td");
    const expectedDelay = document.createElement("td");
    const maxDelay = document.createElement("td");

    minDelay.textContent = formatDuration(point.minDelayMs, normalizedMode);
    expectedDelay.textContent = formatDuration(point.expectedDelayMs, normalizedMode);
    maxDelay.textContent = formatDuration(point.maxDelayMs, normalizedMode);

    row.append(retry, minDelay, expectedDelay, maxDelay, cumulativeDelay);
    return row;
  });

  tbody.replaceChildren(...rows);
}

/**
 * @param {{totalRetries: HTMLElement, finalDelayMs: HTMLElement, totalDelayMs: HTMLElement}} summaryElements
 */
export function resetSummary(summaryElements) {
  summaryElements.totalRetries.textContent = "-";
  summaryElements.finalDelayMs.textContent = "-";
  summaryElements.totalDelayMs.textContent = "-";
}

/**
 * @param {{totalRetries: number, finalDelayMs: number, totalDelayMs: number}} summary
 * @param {{totalRetries: HTMLElement, finalDelayMs: HTMLElement, totalDelayMs: HTMLElement}} summaryElements
 * @param {DisplayMode} displayMode
 */
export function renderSummary(summary, summaryElements, displayMode = DEFAULT_DISPLAY_MODE) {
  const normalizedMode = resolveDisplayMode(displayMode);
  summaryElements.totalRetries.textContent = summary.totalRetries.toLocaleString();
  summaryElements.finalDelayMs.textContent = formatDuration(summary.finalDelayMs, normalizedMode);
  summaryElements.totalDelayMs.textContent = formatDuration(summary.totalDelayMs, normalizedMode);
}

/**
 * @param {DisplayMode} displayMode
 * @param {{
 *   primaryDelay: HTMLElement,
 *   secondaryDelay: HTMLElement,
 *   tertiaryDelay: HTMLElement,
 *   cumulativeDelay: HTMLElement
 * }} headerElements
 * @param {import("./backoff.js").JitterType} jitterType
 */
export function renderDelayTableHeaders(
  displayMode,
  headerElements,
  jitterType = DEFAULT_JITTER_TYPE,
) {
  const normalizedMode = resolveDisplayMode(displayMode);
  const unit = unitLabel(normalizedMode);
  const normalizedJitter = resolveJitterType(jitterType);

  if (normalizedJitter === "none") {
    headerElements.primaryDelay.textContent = `Delay (${unit})`;
    headerElements.secondaryDelay.hidden = true;
    headerElements.tertiaryDelay.hidden = true;
  } else {
    headerElements.primaryDelay.textContent = `Min Delay (${unit})`;
    headerElements.secondaryDelay.textContent = `Expected Delay (${unit})`;
    headerElements.tertiaryDelay.textContent = `Max Delay (${unit})`;
    headerElements.secondaryDelay.hidden = false;
    headerElements.tertiaryDelay.hidden = false;
  }

  headerElements.primaryDelay.hidden = false;
  headerElements.cumulativeDelay.textContent = `Cumulative Delay (${unit})`;
}

/**
 * @param {number} value
 */
function formatMathNumber(value) {
  if (!Number.isFinite(value)) {
    return "\u221e";
  }
  return MATH_NUMBER_FORMATTER.format(value);
}

/**
 * @param {number} value
 * @param {DisplayMode} displayMode
 */
function formatResultValue(value, displayMode) {
  return formatDuration(value, resolveDisplayMode(displayMode));
}

/**
 * @param {string} tagName
 * @param {string} text
 * @param {string} [className]
 */
function createMathNode(tagName, text, className = "") {
  const node = document.createElementNS(MATHML_NAMESPACE, tagName);
  node.textContent = text;
  if (className.length > 0) {
    node.setAttribute("class", className);
  }
  return node;
}

/**
 * @param {string} name
 * @param {string} [className]
 */
function createIdentifierNode(name, className = "") {
  // Safari can overlap glyphs for long <mi> identifiers in superscripts.
  const tagName = name.length > 1 ? "mtext" : "mi";
  const node = createMathNode(tagName, name, className);
  if (tagName === "mi") {
    node.setAttribute("mathvariant", "normal");
  }
  return node;
}

/**
 * @param {string} name
 * @param {string} className
 */
function createVariableNode(name, className) {
  return createIdentifierNode(name, `math-var ${className}`);
}

/**
 * @param {string | number} value
 * @param {string} className
 */
function createNumberNode(value, className = "") {
  return createMathNode("mn", String(value), className.length > 0 ? `math-var ${className}` : "");
}

/**
 * @param {string} value
 * @param {string} className
 */
function createTextNode(value, className = "") {
  return createMathNode("mtext", value, className.length > 0 ? `math-var ${className}` : "");
}

/**
 * @param {number} valueMs
 * @param {string} className
 * @param {DisplayMode} displayMode
 */
function createDurationValueNode(valueMs, className, displayMode) {
  if (!Number.isFinite(valueMs)) {
    return createTextNode("\u221e", className);
  }
  return createTextNode(formatResultValue(valueMs, displayMode), className);
}

/**
 * @param {number} value
 * @param {string} className
 */
function createScalarValueNode(value, className) {
  return createNumberNode(formatMathNumber(value), className);
}

/**
 * @param {string} name
 */
function classForNamedSymbol(name) {
  const classByName = {
    baseValue: "math-var--base",
    cappedValue: "math-var--capped",
    jitteredValue: "math-var--jittered",
    chartValue: "math-var--chart",
    initialDelayMs: "math-var--initial",
    backoffFactor: "math-var--factor",
    linearIncrementMs: "math-var--increment",
    maxDelayCapMs: "math-var--cap",
    retryNumber: "math-var--retry",
    stepNumber: "math-var--retry",
  };
  return classByName[name] ?? "math-var--chart";
}

/**
 * @param {string} name
 */
function createNamedNode(name) {
  return createVariableNode(name, classForNamedSymbol(name));
}

/**
 * @param {number | string} token
 */
function createRetryTokenNode(token) {
  if (typeof token === "number") {
    return createNumberNode(token, "math-var--retry");
  }
  return createNamedNode(token);
}

function createEqualsNode() {
  return createMathNode("mo", "=");
}

/**
 * @param {ChartMathExplanationModel} model
 * @param {"initialDelayMs" | "factor" | "incrementMs" | "maxDelayMs"} key
 * @param {boolean} substitute
 * @param {DisplayMode} displayMode
 */
function createConstantNode(model, key, substitute, displayMode) {
  const descriptors = {
    initialDelayMs: {
      symbolName: "initialDelayMs",
      className: "math-var--initial",
      isDuration: true,
    },
    factor: {
      symbolName: "backoffFactor",
      className: "math-var--factor",
      isDuration: false,
    },
    incrementMs: {
      symbolName: "linearIncrementMs",
      className: "math-var--increment",
      isDuration: true,
    },
    maxDelayMs: {
      symbolName: "maxDelayCapMs",
      className: "math-var--cap",
      isDuration: true,
    },
  };
  const descriptor = descriptors[key];

  if (!substitute) {
    return createNamedNode(descriptor.symbolName);
  }

  const value = model.constants[key];
  if (value == null) {
    return createTextNode("\u221e", descriptor.className);
  }

  if (descriptor.isDuration) {
    return createDurationValueNode(value, descriptor.className, displayMode);
  }

  return createScalarValueNode(value, descriptor.className);
}

/**
 * @param {ChartMathExplanationModel} model
 * @param {{
 *   retryToken:number | string,
 *   substituteConstants:boolean,
 *   displayMode:DisplayMode
 * }} options
 */
function createBaseExpression(model, options) {
  const row = document.createElementNS(MATHML_NAMESPACE, "mrow");

  if (model.strategy === "exponential") {
    const exponent = document.createElementNS(MATHML_NAMESPACE, "mrow");
    exponent.append(
      createRetryTokenNode(options.retryToken),
      createMathNode("mo", "-"),
      createMathNode("mn", "1"),
    );
    const power = document.createElementNS(MATHML_NAMESPACE, "msup");
    power.append(
      createConstantNode(model, "factor", options.substituteConstants, options.displayMode),
      exponent,
    );

    row.append(
      createConstantNode(model, "initialDelayMs", options.substituteConstants, options.displayMode),
      createMathNode("mo", "\u00d7"),
      power,
    );
    return row;
  }

  if (model.strategy === "linear") {
    const offset = document.createElementNS(MATHML_NAMESPACE, "mrow");
    offset.append(
      createRetryTokenNode(options.retryToken),
      createMathNode("mo", "-"),
      createMathNode("mn", "1"),
    );

    row.append(
      createConstantNode(model, "initialDelayMs", options.substituteConstants, options.displayMode),
      createMathNode("mo", "+"),
      createMathNode("mo", "("),
      offset,
      createMathNode("mo", ")"),
      createMathNode("mo", "\u00d7"),
      createConstantNode(model, "incrementMs", options.substituteConstants, options.displayMode),
    );
    return row;
  }

  row.append(
    createConstantNode(model, "initialDelayMs", options.substituteConstants, options.displayMode),
  );
  return row;
}

/**
 * @param {MathMLElement} sourceNode
 * @param {MathMLElement} capNode
 */
function createMinExpression(sourceNode, capNode) {
  const row = document.createElementNS(MATHML_NAMESPACE, "mrow");
  row.append(
    createIdentifierNode("min"),
    createMathNode("mo", "("),
    sourceNode,
    createMathNode("mo", ","),
    capNode,
    createMathNode("mo", ")"),
  );
  return row;
}

/**
 * @param {ChartMathExplanationModel} model
 */
function jitterBounds(model) {
  if (model.jitterType === "equal") {
    return { min: "0.5", max: "1.0" };
  }
  return { min: "0.0", max: "1.0" };
}

/**
 * @param {string} min
 * @param {string} max
 */
function createRandomNode(min, max) {
  const row = document.createElementNS(MATHML_NAMESPACE, "mrow");
  row.append(
    createIdentifierNode("random"),
    createMathNode("mo", "("),
    createMathNode("mn", min),
    createMathNode("mo", ","),
    createMathNode("mn", max),
    createMathNode("mo", ")"),
  );
  return row;
}

/**
 * @param {MathMLElement} sourceNode
 * @param {ChartMathExplanationModel} model
 */
function createJitterCoreExpression(sourceNode, model) {
  const { min, max } = jitterBounds(model);
  const row = document.createElementNS(MATHML_NAMESPACE, "mrow");
  row.append(
    sourceNode,
    createMathNode("mo", "\u00d7"),
    createRandomNode(min, max),
  );
  return row;
}

/**
 * @param {MathMLElement} node
 */
function createExpectedExpression(node) {
  const row = document.createElementNS(MATHML_NAMESPACE, "mrow");
  row.append(
    createIdentifierNode("expected"),
    createMathNode("mo", "("),
    node,
    createMathNode("mo", ")"),
  );
  return row;
}

/**
 * @param {MathMLElement} sourceNode
 * @param {number | string} retryToken
 */
function createCumulativeExpression(sourceNode, retryToken) {
  const row = document.createElementNS(MATHML_NAMESPACE, "mrow");
  row.append(
    createMathNode("mo", "\u03A3"),
    createMathNode("mo", "("),
    createNamedNode("stepNumber"),
    createMathNode("mo", "="),
    createMathNode("mn", "1"),
    createMathNode("mo", ".."),
    createRetryTokenNode(retryToken),
    createMathNode("mo", ","),
    sourceNode,
    createMathNode("mo", ")"),
  );
  return row;
}

/**
 * @param {ChartMathExplanationModel} model
 * @param {MathMLElement} sourceNode
 * @param {number | string} retryToken
 */
function createJitterExpression(model, sourceNode, retryToken) {
  let expression = createJitterCoreExpression(sourceNode, model);

  if (model.chartSeriesMode === "expected") {
    expression = createExpectedExpression(expression);
  }

  if (model.chartMode === "cumulative") {
    expression = createCumulativeExpression(expression, retryToken);
  }

  return expression;
}

/**
 * @param {number | null} valueMs
 * @param {string} className
 * @param {DisplayMode} displayMode
 */
function createResolvedValueNode(valueMs, className, displayMode) {
  if (valueMs == null || !Number.isFinite(valueMs)) {
    return null;
  }
  return createDurationValueNode(valueMs, className, displayMode);
}

/**
 * @param {string} sourceName
 * @param {string} sourceClassName
 * @param {number | null} sourceValueMs
 * @param {DisplayMode} displayMode
 */
function createSourceNode(sourceName, sourceClassName, sourceValueMs, displayMode) {
  if (sourceValueMs == null || !Number.isFinite(sourceValueMs)) {
    return createNamedNode(sourceName);
  }
  return createDurationValueNode(sourceValueMs, sourceClassName, displayMode);
}

/**
 * @param {string} leftName
 * @param {MathMLElement} expression
 * @param {MathMLElement | null} resolvedValueNode
 */
function createEquationMath(leftName, expression, resolvedValueNode) {
  const row = document.createElementNS(MATHML_NAMESPACE, "mrow");
  row.append(createNamedNode(leftName), createEqualsNode(), expression);

  if (resolvedValueNode != null) {
    row.append(createEqualsNode(), resolvedValueNode);
  }

  const math = document.createElementNS(MATHML_NAMESPACE, "math");
  math.setAttribute("display", "block");
  math.append(row);
  return math;
}

/**
 * @param {MathMLElement} math
 */
function createMathFormulaRow(math) {
  const row = document.createElement("div");
  row.className = "math-explainer-formula";
  row.append(math);
  return row;
}

/**
 * @param {HTMLElement} equations
 * @param {MathMLElement[]} rows
 */
function renderFormulaRows(equations, rows) {
  equations.replaceChildren(...rows.map((row) => createMathFormulaRow(row)));
  queueMathTypeset(equations);
}

/**
 * @param {ChartMathExplanationModel} model
 * @param {{
 *   equations: HTMLElement
 * }} elements
 * @param {DisplayMode} displayMode
 */
export function renderChartMathExplanation(
  model,
  elements,
  displayMode = DEFAULT_DISPLAY_MODE,
) {
  const normalizedMode = resolveDisplayMode(displayMode);
  const hasHover = model.activeRetry != null;
  const hasJitterRow = model.jitterType !== "none";
  const cumulativeWithoutJitter = model.chartMode === "cumulative" && !hasJitterRow;
  const symbolicRetryToken = "retryNumber";
  const substitutedRetryToken = hasHover ? model.activeRetry : symbolicRetryToken;
  const rows = [];

  const baseSymbolicExpression = createBaseExpression(model, {
    retryToken: symbolicRetryToken,
    substituteConstants: false,
    displayMode: normalizedMode,
  });
  const baseSubstitutedExpression = hasHover
    ? createBaseExpression(model, {
        retryToken: substitutedRetryToken,
        substituteConstants: true,
        displayMode: normalizedMode,
      })
    : null;
  const useCumulativeBaseRow = cumulativeWithoutJitter && !model.hasCap;
  const baseExpressionSymbolic = useCumulativeBaseRow
    ? createCumulativeExpression(baseSymbolicExpression, symbolicRetryToken)
    : baseSymbolicExpression;
  const baseExpressionSubstituted =
    hasHover && baseSubstitutedExpression != null
      ? useCumulativeBaseRow
        ? createCumulativeExpression(baseSubstitutedExpression, substitutedRetryToken)
        : baseSubstitutedExpression
      : null;
  const baseResolvedValueMs = hasHover
    ? useCumulativeBaseRow
      ? model.resolved.chartedValueMs
      : model.resolved.rawDelayMs
    : null;
  const baseExpression = hasHover ? baseExpressionSubstituted : baseExpressionSymbolic;
  rows.push(
    createEquationMath(
      "baseValue",
      baseExpression,
      createResolvedValueNode(baseResolvedValueMs, "math-var--base", normalizedMode),
    ),
  );

  let previousSourceName = "baseValue";
  let previousSourceClassName = "math-var--base";
  let previousSourceValueMs = baseResolvedValueMs;

  if (model.hasCap) {
    const capSymbolicExpression = createMinExpression(
      createNamedNode("baseValue"),
      createConstantNode(model, "maxDelayMs", false, normalizedMode),
    );
    const capSubstitutedExpression = hasHover
      ? createMinExpression(
          createSourceNode(
            "baseValue",
            "math-var--base",
            previousSourceValueMs,
            normalizedMode,
          ),
          createConstantNode(model, "maxDelayMs", true, normalizedMode),
        )
      : null;
    const useCumulativeCapRow = cumulativeWithoutJitter;
    const capExpressionSymbolic = useCumulativeCapRow
      ? createCumulativeExpression(capSymbolicExpression, symbolicRetryToken)
      : capSymbolicExpression;
    const capExpressionSubstituted =
      hasHover && capSubstitutedExpression != null
        ? useCumulativeCapRow
          ? createCumulativeExpression(capSubstitutedExpression, substitutedRetryToken)
          : capSubstitutedExpression
        : null;
    const cappedResolvedValueMs = hasHover
      ? useCumulativeCapRow
        ? model.resolved.chartedValueMs
        : model.resolved.cappedDelayMs
      : null;
    const capExpression = hasHover ? capExpressionSubstituted : capExpressionSymbolic;

    rows.push(
      createEquationMath(
        "cappedValue",
        capExpression,
        createResolvedValueNode(cappedResolvedValueMs, "math-var--capped", normalizedMode),
      ),
    );

    previousSourceName = "cappedValue";
    previousSourceClassName = "math-var--capped";
    previousSourceValueMs = cappedResolvedValueMs;
  }

  if (hasJitterRow) {
    const jitterSymbolicExpression = createJitterExpression(
      model,
      createNamedNode(previousSourceName),
      symbolicRetryToken,
    );
    const jitterSubstitutedExpression = hasHover
      ? createJitterExpression(
          model,
          createSourceNode(
            previousSourceName,
            previousSourceClassName,
            previousSourceValueMs,
            normalizedMode,
          ),
          substitutedRetryToken,
        )
      : null;
    const jitterResolvedValueMs = hasHover ? model.resolved.chartedValueMs : null;
    const jitterExpression = hasHover ? jitterSubstitutedExpression : jitterSymbolicExpression;

    rows.push(
      createEquationMath(
        "jitteredValue",
        jitterExpression,
        createResolvedValueNode(jitterResolvedValueMs, "math-var--jittered", normalizedMode),
      ),
    );

    previousSourceName = "jitteredValue";
    previousSourceClassName = "math-var--jittered";
    previousSourceValueMs = jitterResolvedValueMs;
  }

  renderFormulaRows(elements.equations, rows);
}
