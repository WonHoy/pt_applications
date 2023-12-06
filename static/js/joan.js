// import { saveAs } from 'file-saver';
import { Part } from "./part.js";
import { Node } from "./node.js";
import { Plate } from "./plate.js";
import { Fastener } from "./fastener.js";
import { Constraint } from "./constraint.js";
import { Load } from "./load.js";
import { Material } from "./material.js";

(function () {
  $(document).ready(() => {
    // Model
    let modelCols = 21;
    let modelRows = 6;

    // Number of columns
    const colsAmount = $('#cols-amount');
    colsAmount.val(21);
    colsAmount.on("change", (e) => {
      modelCols = +$(e.target).val()
    });

    // Number of rows
    const rowsAmount = $('#rows-amount');
    rowsAmount.val(6);
    rowsAmount.on("change", (e) => {
      modelRows = +$(e.target).val()
    });

    $('#draw-grid').on("click", (e) => {
      console.log(modelCols, modelRows);
      drawGrid(modelCols, modelRows);
    });

    const modelBlock = $('.model');
    const inputBlock = $('.input-data');

    $('.accordion-button.input-mode-toggle-button').on("click", (e) => {
      if ($(e.target).hasClass('collapsed')) {
        $(e.target).text('Expand Input/Output Mode');
      } else {
        $(e.target).text('Collapse Input/Output Mode');
      }
    });

    $('.accordion-button.input-data-toggle-button').on("click", (e) => {
      if ($(e.target).hasClass('collapsed')) {
        $(e.target).text('Expand Input Data');
      } else {
        $(e.target).text('Collapse Input Data');
      }
    });

    let spacingTableCells = null;
    let spacingArray = null;
    
    // Tables
    const partTableBody = $(".table-parts tbody");
    const nodeTableBody = $(".table-nodes tbody");
    const plateTableBody = $(".table-plates tbody");
    const fastTableBody = $(".table-fasteners tbody");
    const reactTableBody = $(".table-reactions tbody");
    const loadTableBody = $(".table-loads tbody");

    // Data from DB
    let materialsDB = `[
            {
                "name": "2024",
                "ht": "T3",
                "E": 10300000
            },
            {
                "name": "7075",
                "ht": "T6",
                "E": 10500000
            },
            {
                "name": "user defined",
                "ht": "",
                "E": 10000000
            }
        ]`;
    let materials = JSON.parse(materialsDB);

    $("#input-material-datalist").autocomplete();
    $("#input-alloy-datalist").autocomplete();
    $("#input-spec-datalist").autocomplete();
    $("#input-form-datalist").autocomplete();
    $("#input-ht-datalist").autocomplete();

    const chooseMaterialFromDB = $(".material-from-DB");
    const defineMaterialByUser = $(".material-user-defined");
    const saveMaterial = $("#save-material");
    const modalMaterialInputs = $(".modal-body input");
    const modal = $(".modal");
    let materialsArray = [];
    let material = null;
    let target;
    let part = null;
    let chartOpacity = 1;

    chooseMaterialFromDB.on("click", function (e) {
      $(e.target).parents("ul").prev().text($(e.target).text());
      target = $(e.target);
      for (let input of modalMaterialInputs) {
        $(input).val("").css({ "border-color": "unset" });
      }
    });

    const partsBlock = $(".parts");

    saveMaterial.on("click", function (event) {
      event.stopPropagation();
      material = new Material();
      let rowIndex = null;
      Array.from(modalMaterialInputs).forEach((item) => {
        const labelText = $(item).prev().text().trim();
        const spaceIndex = labelText.indexOf(" ");
        if (spaceIndex > -1) {
          const prop = labelText.slice(spaceIndex + 1).replace(" ", "_");
          material[prop] = $(item).val();
        }
      });
      if (material.alloy && material.heat_treatment) {
        rowIndex = findRowIndex(target.parents("tr")[0], partTableBody);
        target
          .parent()
          .parent()
          .parent()
          .parent()
          .next()
          .text(
            `${material.material} ${material.alloy}-${material.heat_treatment} ${material.form} ${material.specification}`
          );
      }
      const partMaterial = materials.find(
        (item) =>
          item.name === material.alloy && item.ht === material.heat_treatment
      );
      if (partMaterial) {
        target
          .parent()
          .parent()
          .parent()
          .parent()
          .next()
          .next()
          .text(partMaterial.E);
        material.E = partMaterial.E;
      } else {
        target
          .parent()
          .parent()
          .parent()
          .parent()
          .next()
          .next()
          .text("")
          .attr("contenteditable", true);
      }
      materialsArray.push(material);
      //            addMaterialCaption(material, rowIndex);
      target = null;

      function addMaterialCaption(material, index) {
        const caption = $(document.createElement("div"));
        caption.text(
          `(${index + 1}) ${material.material} ${material.alloy}-${
            material.heat_treatment
          } ${material.form} ${material.specification}, E = ${material.E}`
        );
        caption.css("font-size", "12px");
        partsBlock.append(caption);
      }
    });

    modalMaterialInputs.on("change", (e) => {
      if ($(e.target).val()) {
        $(e.target).css({ "border-color": "green" });
      } else {
        $(e.target).css({ "border-color": "red" });
      }
    });

    defineMaterialByUser.on("click", (e) => {
      $(e.target).parents("ul").prev().text($(e.target).text());
      $(e.target)
        .parents("td")[0]
        .nextElementSibling.setAttribute("contenteditable", true);
      $(e.target)
        .parents("td")[0]
        .nextElementSibling.nextElementSibling.setAttribute(
          "contenteditable",
          true
        );
    });

    let fastenersDB = `[
            {"name": "BACR15GF","type": "rivet","subtype": "solid", "nomDia": 5,"Ebb": 10300000,"Gb": 4000000},
            {"name": "BACB15VU","type": "bolt","subtype": "protruding", "nomDia": 6,"Ebb": 16000000,"Gb": 6150000}
        ]`;
    let fasteners = JSON.parse(fastenersDB);

    let parts = document.getElementsByClassName("part");

    const materialSelect = $(".material-select");
    const fastenerSelect = $(".fastener-select");

    const creationMode = $("#creation-mode");
    const partSelection = $("#part-selection");
    const deletionMode = $("#deletion-mode");
    const createInput = $("#creation-mode-radio");
    const deleteInput = $("#deletion-mode-radio");

    const canvas = document.getElementById("canvas");
    const defaultCanvasWidth = 1317;
    const defaultCanvasHeight = 400;
    const ctx = canvas.getContext("2d");
    canvas.setAttribute("width", defaultCanvasWidth);
    canvas.setAttribute("height", defaultCanvasHeight);

    const defaultSpacing = 0.75;

    part = null;
    let node = null;
    let plate = null;
    let fastener = null;
    let constraint = null;
    let load = null;
    let partsArray = [];
    let nodesArray = [];
    let platesArray = [];
    let fastArray = [];
    let constraintsArray = [];
    let loadsArray = [];

    let node1 = null;
    let node2 = null;

    let col = null;
    let row = null;
    let coord = null;
    let index = null;

    Array.from(partTableBody.children()).forEach((item) => {
      part = new Part();
      part.name = $(item).children()[0].innerText;
      partsArray.push(part);
    });

    // Добавляем/удаляем парты по выбранному значению в селекте
    const partAmountSelect = $("#parts-amount");
    partAmountSelect.on("change", (e) => {
      let currentPartsAmount = document.getElementsByClassName("part").length;
      let addParts = $(e.target).val() - currentPartsAmount;
      if (addParts > 0) {
        for (let i = 0; i < addParts; i++) {
          addPartAtTableAndSelection();
        }
      } else {
        for (let i = 0; i < Math.abs(addParts); i++) {
          partTableBody.children().last().remove();
          partSelection.children().last().remove();
          partsArray.pop();
        }
      }
    });

    fastenerSelect.on("change", (e) => {
      const fastRow = $(e.target).parents("tr");
      const fastenerType = fastRow.find(".col2 select").val();
      const fastenerPN = $(e.target).val();
      const fastenerNomDia = fastRow.find(".col4 select").val();
      const fastener = fasteners.find(
        (item) =>
          item.name === fastenerPN &&
          item.nomDia === +fastenerNomDia &&
          item.type === fastenerType
      );
      if (fastener) {
        $(e.target)
          .parent()
          .next()
          .next()
          .text((fastenerNomDia / 32).toFixed(3));
        const fastenerDia = $(e.target).parent().next().next().text();
        const fastRow = $($(e.target).parent()[0]).parent()[0];
        const fastSpacing = $(e.target).parent().siblings(".col7").text();
        const index = Array.from(fastTableBody.children()).indexOf(fastRow);
        if (fastArray[index]) {
          addFastenerProp(
            index,
            ["type", fastenerType],
            ["partNumber", fastenerPN],
            ["nomDia", fastenerNomDia],
            ["fastDia", fastenerDia],
            ["Ebb", fastener.Ebb],
            ["Gb", fastener.Gb],
            ["spacing", fastSpacing]
          );
        }
      } else {
        $(e.target).parent().next().next().text("");
      }
    });

    fastTableBody.find(".col3").on("input", (e) => {
      const rowIndex = findRowIndex($(e.target).parent("tr")[0], fastTableBody);
      fastArray[rowIndex].partNumber = +$(e.target).text();
    });

    fastTableBody.find(".col4").on("input", (e) => {
      const rowIndex = findRowIndex($(e.target).parent("tr")[0], fastTableBody);
      fastArray[rowIndex].nomDia = +$(e.target).text();
    });

    fastTableBody.find(".col5").on("input", (e) => {
      const rowIndex = findRowIndex($(e.target).parent("tr")[0], fastTableBody);
      fastArray[rowIndex].fastDia = +$(e.target).text();
    });

    fastTableBody.find(".col6").on("input", (e) => {
      const rowIndex = findRowIndex($(e.target).parent("tr")[0], fastTableBody);
      fastArray[rowIndex].holeDia = +$(e.target).text();
    });

    fastTableBody.find(".col7").on("input", (e) => {
      const rowIndex = findRowIndex($(e.target).parent("tr")[0], fastTableBody);
      fastArray[rowIndex].Ebb = +$(e.target).text();
    });

    fastTableBody.find(".col8").on("input", (e) => {
      const rowIndex = findRowIndex($(e.target).parent("tr")[0], fastTableBody);
      fastArray[rowIndex].Gb = +$(e.target).text();
    });

    loadTableBody.find(".col2").on("input", (e) => {
      const loadRow = $(e.target).parent()[0];
      const index = Array.from(loadTableBody.children()).indexOf(loadRow);
      loadsArray[index].value = $(e.target).text();
    });

    const output = document.getElementById("output");

    let gridPixelGap = 60;
    const startX = gridPixelGap + 30;
    const startY = gridPixelGap;
    const colGap = 1;
    const rowGap = 1000;
    let scaleFactorRow = rowGap / gridPixelGap;
    let scaleFactorCol = colGap / gridPixelGap;

    
    const canvasWrapper = $(".canvas-wrapper");
    const spacingTableBody = $(".table-spacings tbody");

    drawGrid(modelCols, modelRows);

    function refreshNodeSpacings() {
      nodesArray.forEach((item, index) => {
        if (item.colRow[0] === 1) {
          item.coord = 0;
        } else {
          item.coord = spacingArray
            .slice()
            .splice(0, item.colRow[0] - 1)
            .reduce((a, b) => {
              return +(a + b).toFixed(Math.max(calcDigitsAmountAfterDot(a), calcDigitsAmountAfterDot(b)))
            });
        }
        nodeTableBody.children().eq(index).find(".col2").text(item.coord);
      });
    }

    const nodesThk = document.getElementsByClassName("node-thk");
    const nodeWidthAreaValues =
      document.getElementsByClassName("node-width-area");
    const nodeWidthAreaCalcs = document.getElementsByClassName(
      "node-width-area-calc"
    );

    let units = {
      imperial: {
        length: 'in',
        area: 'in^2',
        modulus: 'psi',
        load: 'lbs'
      },
      si: {
        length: 'mm',
        area: 'mm^2',
        modulus: 'MPa',
        load: 'N'  
      }
    };

    const unitsSelect = $('#units');
    addUnitsToTableHeaders(unitsSelect.val(), 'input-data');

    unitsSelect.change((e) => {
      addUnitsToTableHeaders($(e.target).val(), 'container-fluid');
    });

    function addUnitsToTableHeaders(unitsOption, blockClass) {
      let unitsOptionObj = units[unitsOption];
      Object.keys(unitsOptionObj).forEach(measureKey => {
        const measurableElements = $(`.${blockClass} .measurable.` + measureKey);
        Array.from(measurableElements).forEach(item => {
          const commaIndex = $(item).text().indexOf(',');
          if (commaIndex > -1) {
            $(item).text($(item).text().split(',')[0]);
          }
          $(item).text($(item).text() + `, ${unitsOptionObj[measureKey]}`);
        })
      })  
    }

    const widthAreaCalc = $("#widthAreaCalc");
    const widthAreaSelect = $("#width-area-select");

    widthAreaSelect.on("change", (e) => {
      widthAreaCalc.text(
        $(e.target).val() === "width" ? "Bypass Area" : "Width"
      );
      let measure = "";
      if ($(e.target).val() === "width") {
        widthAreaCalc.addClass("area");
        measure = "area";
        widthAreaCalc.removeClass("width");
      } else {
        widthAreaCalc.addClass("width");
        measure = "length";
        widthAreaCalc.removeClass("area");
      }
      const commaIndex = widthAreaCalc.text().indexOf(',');
      if (commaIndex > -1) {
        widthAreaCalc.text(widthAreaCalc.text().split(',')[0]);
      }
      widthAreaCalc.text(widthAreaCalc.text() + `, ${units[unitsSelect.val()][measure]}`);
      Array.from(nodeWidthAreaValues).forEach((item) => {
        $(item)
          .next()
          .text(
            calcNodeWidthArea(
              widthAreaCalc.text().toLowerCase(),
              $(item).prev().text(),
              $(item).text()
            )
          );
      });
    });

    $(nodeWidthAreaValues).on("input", (e) => {
      $(e.target)
        .next()
        .text(
          calcNodeWidthArea(
            widthAreaCalc.text().toLowerCase(),
            $(e.target).prev().text(),
            $(e.target).text()
          )
        );
      const rowIndex = findRowIndex($(e.target).parent("tr")[0], nodeTableBody);
      if (widthAreaSelect.val() === "width") {
        nodesArray[rowIndex].width = +$(e.target).text();
        nodesArray[rowIndex].area = +$(e.target).next().text();
      } else {
        nodesArray[rowIndex].area = +$(e.target).text();
        nodesArray[rowIndex].width = +$(e.target).next().text();
      }
    });

    $(nodesThk).on("input", (e) => {
      $(e.target)
        .siblings(".col5")
        .text(
          calcNodeWidthArea(
            widthAreaCalc.text().toLowerCase(),
            $(e.target).text(),
            $(e.target).next().text()
          )
        );
      const rowIndex = findRowIndex($(e.target).parent("tr")[0], nodeTableBody);
      nodesArray[rowIndex].thk = +$(e.target).text();
    });

    const outputNodeMode = $(".node-checkbox");
    const outputPlateMode = $(".plate-checkbox");
    const outputFastenerMode = $(".fastener-checkbox");
    let partNames = [];

    outputFastenerMode.on("change", (e) => {
      if (calcResults) {
        refreshModel(chartOpacity);
        showOutputNodeMode();
        showOutputPlateMode();
        showOutputFastenerMode();
        drawPartNames();
      }
    });

    outputPlateMode.on("change", (e) => {
      if (calcResults) {
        refreshModel(chartOpacity);
        showOutputNodeMode();
        showOutputFastenerMode();
        showOutputPlateMode();
        drawPartNames();
      }
    });

    outputNodeMode.on("change", (e) => {
      if (calcResults) {
        refreshModel(chartOpacity);
        showOutputPlateMode();
        showOutputFastenerMode();
        showOutputNodeMode();
        drawPartNames();
      }
    });

    let rectWidthArr = [];
    let minLeftRectVertCoord = 0;

    function showOutputFastenerMode() {
      if (calcResults) {
        let total = 0;
        Array.from(outputFastenerMode).forEach((item) => {
          if (item.checked) {
            total++;
          }
        });
        let count = 0;
        Array.from(outputFastenerMode).forEach((item, i) => {
          if (item.checked) {
            count++;
            switch (item.value) {
              case "load": {
                showLoadTransfer(
                  calcResults.fasteners_loads_traffics,
                  count,
                  total,
                  "fastener_load"
                );
                break;
              }
              case "stiffness": {
                fastArray.forEach((fastener) => {
                  drawResults(
                    fastener.Ebb,
                    fastener.firstNode,
                    fastener.secondNode,
                    "gray",
                    count,
                    total,
                    "fastener_stiffness"
                  );
                });
                break;
              }
              case "diameter": {
                fastArray.forEach((fastener) => {
                  drawResults(
                    fastener.fastDia,
                    fastener.firstNode,
                    fastener.secondNode,
                    "gray",
                    count,
                    total,
                    "fastener_diameter"
                  );
                });
                break;
              }
            }
          }
        });
      }
    }

    function showOutputNodeMode() {
      if (calcResults) {
        let total = 0;
        Array.from(outputNodeMode).forEach((item) => {
          if (item.checked) {
            total++;
          }
        });
        let count = 0;
        Array.from(outputNodeMode).forEach((item, i) => {
          if (item.checked) {
            count++;
            switch (item.value) {
              case "thickness": {
                nodesArray.forEach((node) => {
                  drawResults(
                    node.thk,
                    node,
                    null,
                    "blue",
                    count,
                    total,
                    "node_thickness"
                  );
                });
                break;
              }
              case "area": {
                nodesArray.forEach((node) => {
                  drawResults(
                    node.area,
                    node,
                    null,
                    "blue",
                    count,
                    total,
                    "node_area"
                  );
                });
                break;
              }
              case "width": {
                nodesArray.forEach((node) => {
                  drawResults(
                    node.width,
                    node,
                    null,
                    "blue",
                    count,
                    total,
                    "node_width"
                  );
                });
                break;
              }
            }
          }
        });
      }
    }

    function showOutputPlateMode() {
      if (calcResults) {
        let total = 0;
        Array.from(outputPlateMode).forEach((item) => {
          if (item.checked) {
            total++;
          }
        });
        let count = 0;

        Array.from(outputPlateMode).forEach((item, i) => {
          if (item.checked) {
            count++;
            switch (item.value) {
              case "load": {
                showAppliedLoad(count, total);
                showReactions(calcResults.reactions, count, total);

                // const sortedData = calcResults.loads_and_stresses
                //   .slice()
                //   .sort(
                //     (item1, item2) =>
                //       item1.node_id +
                //       item1.coord_y -
                //       (item2.node_id + item2.coord_y)
                //   );
                // sortedData.forEach((dataItem) => {
                //   drawPlateLoad(
                //     dataItem,
                //     sortedData,
                //     count,
                //     total,
                //     "plate_load"
                //   );
                // });

                calcResults.plate_stiffnesses.forEach((plate) => {
                  const currentPlate = platesArray.find(
                    (item) =>
                      transformPartNames(item.partName) === plate.plate_id &&
                      Math.min(
                        item.firstNode.colRow[0],
                        item.secondNode.colRow[0]
                      ) === Math.min(plate.node1_id, plate.node2_id) &&
                      Math.max(
                        item.firstNode.colRow[0],
                        item.secondNode.colRow[0]
                      ) === Math.max(plate.node1_id, plate.node2_id)
                  );
                  if (plate) {
                    drawResults(
                      plate.end_load,
                      currentPlate.firstNode,
                      currentPlate.secondNode,
                      null,
                      count,
                      total,
                      "plate_load"
                    );
                  }
                });
                break;
              }
              case "stiffness": {
                calcResults.plate_stiffnesses.forEach((plate) => {
                  const currentPlate = platesArray.find(
                    (item) =>
                      transformPartNames(item.partName) === plate.plate_id &&
                      Math.min(
                        item.firstNode.colRow[0],
                        item.secondNode.colRow[0]
                      ) === Math.min(plate.node1_id, plate.node2_id) &&
                      Math.max(
                        item.firstNode.colRow[0],
                        item.secondNode.colRow[0]
                      ) === Math.max(plate.node1_id, plate.node2_id)
                  );
                  if (plate) {
                    drawResults(
                      plate.stiffness,
                      currentPlate.firstNode,
                      currentPlate.secondNode,
                      null,
                      count,
                      total,
                      "plate_stiffness"
                    );
                  }
                });
                break;
              }
            }
          }
        });
      }
    }

    function findRowIndex(row, table) {
      return Array.from(table.children()).indexOf(row);
    }

    function calcNodeWidthArea(whatCalc, thkVal, widthOrAreaVal) {
      if (thkVal && widthOrAreaVal) {
        let output = null;
        if (whatCalc === "width") {
          output = +widthOrAreaVal / +thkVal;
        } else {
          output = +widthOrAreaVal * +thkVal;
        }
        return output >= Math.pow(10, -3)
          ? output.toFixed(3)
          : output.toExponential(2);

        // return output;
      }
      return null;
    }

    function createJSONFromTable(elemTable, elemArray) {
      const item = Array.from(elemTable.find("td")).find(
        (item) => !item.innerText
      );
      if (item && elemTable !== reactTableBody) {
        alert("Заполните все данные в таблице");
      } else {
        return JSON.stringify(elemArray);
      }
    }

    let partHorCoordArr = [];
    $(canvas).on("click", (e) => {
      //            output.innerText = `Координаты клика: ${e.offsetX}, ${e.offsetY}. `;
      const clickRadius = 15;
      for (let i = startX; i < canvas.width; i += gridPixelGap) {
        for (let j = startY; j < canvas.height; j += gridPixelGap) {
          if ($(createInput).prop("checked")) {
            switch (creationMode.val()) {
              case "node":
                if (
                  Math.abs(e.offsetX - i) < clickRadius &&
                  Math.abs(e.offsetY - j) < clickRadius
                ) {
                  if (
                    nodesArray.findIndex(
                      (item) => item.XY[0] === i && item.XY[1] === j
                    ) === -1
                  ) {
                    createNode(i, j);
                  }
                }
                break;
              case "plate":
                if (Math.abs(e.offsetY - j) < clickRadius) {
                  if (e.offsetX - i > 0 && e.offsetX - i < gridPixelGap) {
                    node1 = nodesArray.find(
                      (item) => item.XY[0] === i && item.XY[1] === j
                    );
                    node2 = nodesArray.find(
                      (item) =>
                        item.XY[0] === i + gridPixelGap && item.XY[1] === j
                    );
                    if (node1 && node2) {
                      index = findLineElementBtwNodes(
                        platesArray,
                        node1,
                        node2
                      );
                      if (index === -1) {
                        createPlate(node1, node2);
                      }
                    }
                    node1 = null;
                    node2 = null;
                  }
                }
                break;
              case "fastener":
                if (Math.abs(e.offsetX - i) < clickRadius) {
                  const filteredNodes = nodesArray.filter(item => item.XY[0] === i).sort((item1, item2) => item1.XY[1] - item2.XY[1]);
                  let k = 0;
                  while (k < filteredNodes.length) {
                    if (filteredNodes[k].XY[1] - e.offsetY >= 0) {
                      node1 = filteredNodes[k - 1];
                      node2 = filteredNodes[k];
                      break;
                    }
                    k++;
                  }
                  if (node1 && node2) {
                    index = findLineElementBtwNodes(fastArray, node1, node2);
                    if (index === -1) {
                      createFastener(node1, node2);
                    }
                  }
                  node1 = null;
                  node2 = null;
                }
                break;
              case "constraint":
                if (
                  Math.abs(e.offsetX - i) < clickRadius &&
                  Math.abs(e.offsetY - j) < clickRadius
                ) {
                  node1 = nodesArray.find(
                    (item) => item.XY[0] === i && item.XY[1] === j
                  );
                  if (node1) {
                    index = findDotElemAtNode(constraintsArray, node1);
                    if (index === -1) {
                      createConstraint(node1);
                    }
                  }
                  node1 = null;
                }
                break;
              case "load":
                if (
                  Math.abs(e.offsetX - i) < clickRadius &&
                  Math.abs(e.offsetY - j) < clickRadius
                ) {
                  node1 = nodesArray.find(
                    (item) => item.XY[0] === i && item.XY[1] === j
                  );
                  if (node1) {
                    index = findDotElemAtNode(loadsArray, node1);
                    if (index === -1) {
                      createLoad(node1);
                    }
                  }
                  node1 = null;
                }
                break;
            }
          }
          if (deleteInput.prop("checked")) {
            switch (deletionMode.val()) {
              case "node":
                if (
                  Math.abs(e.offsetX - i) < clickRadius &&
                  Math.abs(e.offsetY - j) < clickRadius
                ) {
                  node1 = nodesArray.findIndex(
                    (item) => item.XY[0] === i && item.XY[1] === j
                  );
                  if (node1 > -1) {
                    deleteNode(i, j, node1);
                  }
                  node1 = null;
                }
                break;
              case "plate":
                if (Math.abs(e.offsetY - j) < clickRadius) {
                  if (e.offsetX - i > 0 && e.offsetX - i < gridPixelGap) {
                    node1 = nodesArray.find(
                      (item) => item.XY[0] === i && item.XY[1] === j
                    );
                    node2 = nodesArray.find(
                      (item) =>
                        item.XY[0] === i + gridPixelGap && item.XY[1] === j
                    );
                    if (node1 && node2) {
                      index = findLineElementBtwNodes(
                        platesArray,
                        node1,
                        node2
                      );

                      if (index > -1) {
                        let platePart = platesArray[index].partName;
                        deleteElement(platesArray, index, plateTableBody);
                        if (
                          platesArray.every(
                            (item) => item.partName !== platePart
                          )
                        ) {
                          let deletedPartIndex = partHorCoordArr.findIndex(
                            (item) => item.part === platePart
                          );
                          if (deletedPartIndex > -1) {
                            partHorCoordArr.splice(deletedPartIndex, 1);
                          }
                        }
                      }
                    }

                    node1 = null;
                    node2 = null;
                  }
                }
                break;
              case "fastener":
                if (Math.abs(e.offsetX - i) < clickRadius) {
                  const filteredNodes = nodesArray.filter(item => item.XY[0] === i).sort((item1, item2) => item1.XY[1] - item2.XY[1]);
                  let k = 0;
                  while (k < filteredNodes.length) {
                    if (filteredNodes[k].XY[1] - e.offsetY >= 0) {
                      node1 = filteredNodes[k - 1];
                      node2 = filteredNodes[k];
                      break;
                    }
                    k++;
                  }
                  if (node1 && node2) {
                    index = findLineElementBtwNodes(fastArray, node1, node2);
                    if (index > -1) {
                      deleteElement(fastArray, index, fastTableBody);
                    }
                  }
                  node1 = null;
                  node2 = null;
                }
                break;
              case "constraint":
                if (
                  Math.abs(e.offsetX - i) < clickRadius &&
                  Math.abs(e.offsetY - j) < clickRadius
                ) {
                  index = constraintsArray.findIndex(
                    (item) => item.XY[0] === i && item.XY[1] === j
                  );
                  if (index > -1) {
                    deleteElement(constraintsArray, index, reactTableBody);
                  }
                  index = null;
                }
                break;
              case "load":
                if (
                  Math.abs(e.offsetX - i) < clickRadius &&
                  Math.abs(e.offsetY - j) < clickRadius
                ) {
                  index = loadsArray.findIndex(
                    (item) => item.XY[0] === i && item.XY[1] === j
                  );
                  if (index > -1) {
                    deleteElement(loadsArray, index, loadTableBody);
                  }
                  index = null;
                }
                break;
            }
          }
        }
      }
    });

    //if (e.offsetX < 60 && e.offsetX > 40 && e.offsetY > 40 && e.offsetY < 60) {
    //const ctx = canvas.getContext('2d');
    //ctx.fillStyle = "black";
    //ctx.moveTo(50.5,50.5);
    //ctx.arc(50.5,50.5,5,0,Math.PI*2,true);
    //ctx.fill();
    //output.innerText += `Вы кликнули по красной фигуре!`;
    //output.style.color = 'red';
    //} else if(e.offsetX < 180 && e.offsetX > 100 && e.offsetY > 120 && e.offsetY < 170) {
    //output.innerText += `Вы кликнули по зеленой фигуре!`;
    //output.style.color = 'green';
    // } else {
    //output.style.color = 'black';
    //}
    //        });

    //$(canvas).on("mousemove", function(e) {
    //    var pos = $(this).offset();
    //    var elem_left = pos.left.toFixed(0);
    //    var elem_top = pos.top.toFixed(0);
    //    var x = e.pageX - elem_left;
    //    var y = e.pageY - elem_top;
    //    output.innerText = 'Координаты курсора: (' + x + '; ' + y + ')';
    //    for (let k = 50.5; k < $(canvas).width() - 0.5; k += 50) {
    //        for (let j = 50.5; j < $(canvas).height() - 0.5; j += 50) {
    //            if ((x > (k - 10)) && (x < (k + 10)) && (y > (j - 10)) && (y < (j + 10))) {
    //                console.log(1);
    //                $(canvas).css({'cursor': 'pointer'});
    //            } else {
    //                console.log(2);
    //                $(canvas).css({'cursor': 'default'});
    //            }
    //        }
    //    }
    //});

    const methodSelect = $("#method-type");
    const moreInfoLink = $(".more-info");

    methodSelect.on("change", (e) => {
      if ($(e.target).val() === 'boeing3+') {
        moreInfoLink.css({"display": "inline"});
      }
    })

    creationMode.change((e) => {
      if ($(e.target).val() === "plate") {
        $(".part-selection").css("display", "block");
      } else {
        $(".part-selection").css("display", "none");
      }
    });

    const partRowSample = $("tr.part").eq(0).clone(true, true);
    const plateRowSample = $("tr.plate").eq(0).clone(true, true);
    const fastRowSample = $("tr.fastener").eq(0).clone(true, true);
    const reactRowSample = $("tr.reaction").eq(0).clone(true, true);
    const loadRowSample = $("tr.load").eq(0).clone(true, true);
    const partOptionSample = partSelection.children().eq(0).clone(true, true);

    function drawGrid(modelCols = 21, modelRows = 6) {
      ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      if ($(".canvas-wrapper span")) {
        $(".canvas-wrapper span").remove();
      }
      console.log(modelCols, modelRows);

      spacingTableBody.html('');

      canvas.height = defaultCanvasHeight;
      canvas.width = defaultCanvasWidth;

      if (canvas.getContext) {
        $(canvasWrapper).find('input.spacing-input').remove();
        let colArray = [];
        let rowArray = [];

        let col = 1;
        let row = 1000;
        
        
        gridPixelGap = Math.min(Math.floor((canvas.width - startX) / modelCols), Math.floor((canvas.height - startY) / modelRows));
        
        if (gridPixelGap < 60) {
          gridPixelGap = 60;
        } else if (gridPixelGap > 85) {
          gridPixelGap = 85;
        }
        scaleFactorRow = rowGap / gridPixelGap;
        scaleFactorCol = colGap / gridPixelGap;

        canvas.height = startY + gridPixelGap * (modelRows - 0.5);
        canvas.width = startX + gridPixelGap * (modelCols - 0.3);
        
        let spacingIndex = 0;
        for (let i = startX; i < canvas.width; i += gridPixelGap) {
          colArray.push(col);

          ctx.font = "14.5px serif";
          ctx.strokeStyle = "#dee2e6";
          ctx.fillStyle = "black";
          ctx.lineWidth = 1;

          ctx.beginPath();
          ctx.moveTo(i + 0.5, Math.round(gridPixelGap / 3));
          ctx.lineTo(i + 0.5, $(canvas).height());
          ctx.stroke();

          const colElem = document.createElement("span");
          $(colElem).text(col);
          $(colElem).addClass("col");
          $(colElem).css({ left: i - 4 });
          $(canvasWrapper).append(colElem);

          col += colGap;
        
          console.log(spacingIndex, i);
          if (spacingIndex < modelCols - 1) {
            addSpacingToModel(i, spacingIndex);
            addSpacingToTable(spacingIndex);
          }

          spacingIndex++;
        }


        for (let i = startY; i < canvas.height; i += gridPixelGap) {
          rowArray.push(row);

          ctx.beginPath();
          ctx.moveTo(gridPixelGap * 0.6, i + 0.5);
          ctx.lineTo($(canvas).width(), i + 0.5);
          ctx.stroke();

          const rowElem = document.createElement("span");
          $(rowElem).text(row);
          $(rowElem).addClass("row");
          $(rowElem).css({ top: i - 10 });
          $(canvasWrapper).append(rowElem);

          row += rowGap;
        }
      }

      spacingTableCells = document.querySelectorAll(
        ".table-spacings tbody .col2"
      );

      // spacingArray = Array(spacingTableCells.length);
      spacingArray = [];
      for (let i = 0; i < spacingTableCells.length; i++) {
        spacingArray.push(spacingTableCells[i].innerText ? +spacingTableCells[i].innerText : defaultSpacing);
      }
      
      // spacingArray.fill(defaultSpacing);

      const spacingInputs = $(".canvas-wrapper .spacing-input");

      spacingInputs.change((e) => {
        e.target.value = (+e.target.value).toFixed(3);
        let inputIndex = $.inArray(e.target, spacingInputs);
        $(spacingTableCells[inputIndex]).text(e.target.value);
        spacingArray[inputIndex] = +$(spacingTableCells[inputIndex]).text();
        refreshNodeSpacings();
        console.log(spacingArray);
      });
  
      $(spacingTableCells).on("input", (e) => {
        let cellIndex = $.inArray(e.target, spacingTableCells);
        $(spacingTableCells[cellIndex]).text();
        $(spacingInputs[cellIndex]).val((+$(e.target).text()).toFixed(3));
        spacingArray[cellIndex] = +$(spacingInputs[cellIndex]).val();
        refreshNodeSpacings();
        console.log(spacingArray);
      });
      $(spacingTableCells).on("blur", (e) => {
        $(e.target).text((+$(e.target).text()).toFixed(3));
      });
      $(spacingTableCells).on("keydown", (e) => {
        if (
          (isNaN(parseInt(e.key)) &&
            !(e.key === "." || e.key === "Backspace" || e.key === "Delete")) ||
          e.key === "Enter"
        ) {
          return false;
        }
      });
    }

    function addSpacingToModel(coordX, spacingIndex) {
      const spacingInput = document.createElement("input");
      $(spacingInput).addClass("spacing-input");
      $(spacingInput).attr("value", (Array.isArray(spacingArray) && spacingArray[spacingIndex]) ? spacingArray[spacingIndex] : defaultSpacing);
      $(spacingInput).attr(
        "id",
        `spacing${spacingIndex + 1}-${spacingIndex + 2}`
      );
      canvasWrapper.append(spacingInput);
      const left = coordX + (gridPixelGap - $(spacingInput).width()) / 2;
      $(spacingInput).css({ left: left });
    }

    function addSpacingToTable(spacingIndex) {
      const spacingInputRow = document.createElement("tr");
      $(spacingInputRow).addClass("spacing");
      const spacingInputCoord = document.createElement("td");
      $(spacingInputCoord).addClass("col1 col-6");
      $(spacingInputCoord).text(`X${spacingIndex + 1}-${spacingIndex + 2}`);
      const spacingInputValue = document.createElement("td");
      $(spacingInputValue).addClass("col2 col-6");
      $(spacingInputValue).attr("contenteditable", true);
      $(spacingInputValue).text((spacingArray && spacingArray[spacingIndex] !== undefined)  ? spacingArray[spacingIndex] : defaultSpacing);
      $(spacingInputRow).append(spacingInputCoord);
      $(spacingInputRow).append(spacingInputValue);
      spacingTableBody.append(spacingInputRow);
    }

    function drawNode(x, y, opacity = 1) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.fillStyle = `rgba(0, 0, 255, ${opacity})`;
      ctx.arc(x, y, 5, 0, Math.PI * 2, true);
      ctx.fill();
    }

    function drawConstraint(x, y, opacity = 1) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(0, 255, 0, ${opacity})`;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 15, y + 20);
      ctx.lineTo(x - 15, y + 20);
      ctx.fill();
      drawNode(x, y, opacity);
    }

    function drawLoad(x, y, opacity = 1) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(0, 255, 255, ${opacity})`;
      ctx.strokeStyle = `rgba(0, 255, 255, ${opacity})`;
      ctx.lineWidth = 4.5;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 35, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 40, y);
      ctx.lineTo(x + 24, y - 8);
      ctx.lineTo(x + 24, y + 8);
      ctx.fill();
      drawNode(x, y, opacity);
    }

    function drawLine(fromX, fromY, toX, toY, color, lineWidth, opacity = 1) {
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.strokeStyle = color.replace("1)", `${opacity})`);
      ctx.lineWidth = lineWidth;
      ctx.lineTo(toX, toY);
      ctx.stroke();
      drawNode(fromX, fromY, opacity);
      drawNode(toX, toY, opacity);
    }

    function refreshModel(opacity = 1) {
      ctx.clearRect(
        startX,
        startY,
        canvas.width - startX,
        canvas.height - startY
      );
      drawGrid(modelCols, modelRows);
      nodesArray.forEach((item) => drawNode(item.XY[0], item.XY[1], opacity));
      platesArray.forEach((item) =>
        drawLine(
          item.firstNode.XY[0],
          item.firstNode.XY[1],
          item.secondNode.XY[0],
          item.secondNode.XY[1],
          "rgba(0, 0, 0, 1)",
          4.5,
          opacity
        )
      );
      fastArray.forEach((item) =>
        drawLine(
          item.firstNode.XY[0],
          item.firstNode.XY[1],
          item.secondNode.XY[0],
          item.secondNode.XY[1],
          "rgba(173, 181, 189, 1)",
          5,
          opacity
        )
      );
      constraintsArray.forEach((item) =>
        drawConstraint(item.XY[0], item.XY[1], opacity)
      );
      loadsArray.forEach((item) => drawLoad(item.XY[0], item.XY[1], opacity));
    }

    function addPartAtTableAndSelection() {
      const partRow = partRowSample.clone(true, true);
      let lastPartRowText = partTableBody
        .children()
        .eq(parts.length - 1)
        .find(".col1")
        .text();
      let partName = String.fromCharCode(
        lastPartRowText.charCodeAt(lastPartRowText.length - 1) + 1
      );
      partRow.find(".col1").text("Part " + partName);
      // partRow
      //   .find(".col2 select")
      //   .attr("id", "material-" + partName)
      //   .attr("name", "material-" + partName);
      // partRow
      //   .find(".col3 select")
      //   .attr("id", "ht-" + partName)
      //   .attr("name", "ht-" + partName);
      partTableBody.append(partRow);

      part = new Part();
      part.name = partRow.find(".col1").text();
      part.material = partRow.find(".col3").text();
      // part.ht = partRow.find(".col3 select").val();
      part.E = partRow.find(".col4").text();

      partsArray.push(part);

      const partOption = partOptionSample.clone(true, true);
      partOption.attr("value", "plate-" + partName);
      partOption.text(
        partTableBody
          .children()
          .eq(parts.length - 1)
          .find(".col1")
          .text()
      );
      partSelection.append(partOption);
    }

    function addNodeAtTable(nodeObj, coordX) {
      const nodeRow = nodeTableBody.children().eq(0).clone(true, true);
      nodeRow.find(".col1").text(nodeObj.row + nodeObj.col);
      nodeRow.find(".col2").text(coordX);
      nodeTableBody.append(nodeRow);
    }

    function addPlateAtTable(
      plateFirstNodeCol,
      plateFirstNodeRow,
      plateSecondNodeCol,
      plateSecondNodeRow
    ) {
      const plateRow = plateRowSample.clone(true, true);
      plateRow
        .find(".col1")
        .text(
          `${Math.round(plateFirstNodeRow + plateFirstNodeCol)}-${Math.round(
            plateSecondNodeRow + plateSecondNodeCol
          )}`
        );
      let selectedPart = partSelection.find("option:selected").text();
      plateRow.find(".col2").text(selectedPart);
      let rowArray = Array.from(partTableBody.children());
      let selectedPartIndex = rowArray.findIndex(
        (item) => $(item).children(".col1").text() === selectedPart
      );
      plateRow
        .find(".col3")
        .text(
          partTableBody.children().eq(selectedPartIndex).find(".col4").text()
        );
      plateTableBody.append(plateRow);
    }

    function addFastAtTable(
      fastFirstNodeCol,
      fastFirstNodeRow,
      fastSecondNodeCol,
      fastSecondNodeRow
    ) {
      const fastRow = fastTableBody
        .children()
        .eq(fastTableBody.children().length - 1)
        .clone(true, true);
      const fastAmount = document.getElementsByClassName("fastener");
      fastTableBody.append(
        fillRow(
          fastTableBody
            .children()
            .eq(fastTableBody.children().length - 1)
            .clone(true, true),
          [
            [
              1,
              `${Math.round(fastFirstNodeRow + fastFirstNodeCol)}-${Math.round(
                fastSecondNodeRow + fastSecondNodeCol
              )}`,
            ],
          ]
        )
      );
      $(fastTableBody.children()[fastTableBody.children().length - 1]).find('.col2 select').attr('id', 'type' + (fastAmount.length) + '-select');
      
      //            $(fastRow).find('.col1').text(`${fastFirstNodeRow + fastFirstNodeCol}-${fastSecondNodeRow + fastSecondNodeCol}`);
      //            $(fastRow).find('.col2 select').attr('id', 'type' + (fastAmount.length + 1) + '-select');
      //            $(fastRow).find('.col2 select').attr('name','type' + (fastAmount.length + 1));
      //            $(fastRow).find('.col3 select').attr('id', 'fastener' + (fastAmount.length + 1) + '-select');
      //            $(fastRow).find('.col3 select').attr('name','fastener' + (fastAmount.length + 1));
      //            $(fastRow).find('.col4 select').attr('id', 'nom-dia' + (fastAmount.length + 1) + '-select');
      //            $(fastRow).find('.col4 select').attr('name','nom-dia' + (fastAmount.length + 1));
      //            fastTableBody.append(fastRow);
    }

    function addConstraintAtTable(nodeObj) {
      const reactRow = reactTableBody.children().eq(0).clone(true, true);
      reactRow.find(".col1").text(nodeObj.row + nodeObj.col);
      reactTableBody.append(reactRow);
    }

    function addLoadAtTable(nodeObj) {
      const loadRow = loadTableBody.children().eq(0).clone(true, true);
      loadRow.find(".col1").text(nodeObj.row + nodeObj.col);
      loadTableBody.append(loadRow);
    }

    function fillRow(row, arrayColsVals) {
      arrayColsVals.forEach((item) => {
        row.find(".col" + item[0]).text(item[1]);
      });
      return row;
    }

    function calcDigitsAmountAfterDot(x) {
      return x.toString().includes('.') ? x.toString().split('.').pop().length : 0;
    }

    function createNode(i, j) {
      const nodeXY = [i, j];
      const nodeColRow = [Math.round((i - (startX - gridPixelGap)) * scaleFactorCol), Math.round((j - (startY - gridPixelGap)) * scaleFactorRow)];
      let coord;
      if (nodeColRow[0] === 1) {
        coord = 0;
      } else {
        coord = spacingArray
          .slice()
          .splice(0, nodeColRow[0] - 1)
          .reduce((a, b) => {
            return +(a + b).toFixed(Math.max(calcDigitsAmountAfterDot(a), calcDigitsAmountAfterDot(b)))
          });
      }
      console.log(nodeColRow);
      const existingFast = fastArray.find(item => {
        return item.firstNode.colRow[0] === nodeColRow[0]
        && (Math.min(item.firstNode.colRow[1], item.secondNode.colRow[1]) < nodeColRow[1]) && (nodeColRow[1] < Math.max(item.firstNode.colRow[1], item.secondNode.colRow[1]));
      });
      if (existingFast) {
        return;
      }

      drawNode(i, j);
      node = new Node(nodeXY, nodeColRow, coord);
      nodesArray.push(node);
      if (nodesArray.length === 1) {
        fillRow(nodeTableBody.children().eq(0), [
          [1, Math.round(nodeColRow[1] + nodeColRow[0])],
          [2, coord],
        ]);
      } else {
        nodeTableBody.append(
          fillRow(
            nodeTableBody
              .children()
              .eq(nodeTableBody.children().length - 1)
              .clone(true, true),
            [
              [1, Math.round(nodeColRow[1] + nodeColRow[0])],
              [2, coord],
            ]
          )
        );
      }
    }

    function createPlate(node1, node2) {
      const partName = partSelection.find("option:selected").text();

      let partHorCoord = {
        part: partName,
        coord: node1.colRow[1],
      };
      let existedPart = partHorCoordArr.find(
        (item) => item.part === partHorCoord.part
      );

      if (existedPart) {
        if (existedPart.coord !== partHorCoord.coord) {
          return;
        }
      } else {
        partHorCoordArr.push(partHorCoord);
      }

      existedPart = null;

      plate = new Plate(node1, node2, partName);
      platesArray.push(plate);
      if (platesArray.length === 1) {
        plateTableBody
          .children()
          .eq(0)
          .find(".col1")
          .text(
            `${Math.round(node1.colRow[1] + node1.colRow[0])}-${Math.round(
              node2.colRow[0] + node2.colRow[1]
            )}`
          );
        const selectedPart = partSelection.find("option:selected").text();
        plateTableBody.children().eq(0).find(".col2").text(selectedPart);
        const rowArray = Array.from(partTableBody.children());
        const selectedPartIndex = rowArray.findIndex(
          (item) => $(item).children(".col1").text() === selectedPart
        );
        plateTableBody
          .children()
          .eq(0)
          .find(".col3")
          .text(
            partTableBody.children().eq(selectedPartIndex).find(".col4").text()
          );
      } else {
        addPlateAtTable(
          node1.colRow[0],
          node1.colRow[1],
          node2.colRow[0],
          node2.colRow[1]
        );
      }
      drawLine(
        node1.XY[0],
        node1.XY[1],
        node2.XY[0],
        node2.XY[1],
        "rgba(0, 0, 0, 1)",
        4.5
      );
    }

    function createFastener(node1, node2) {
      drawLine(
        node1.XY[0],
        node1.XY[1],
        node2.XY[0],
        node2.XY[1],
        "rgba(173, 181, 189, 1)",
        3.5
      );
      fastener = new Fastener(node1, node2);
      fastArray.push(fastener);
      if (fastArray.length === 1) {
        fastTableBody
          .children()
          .eq(0)
          .find(".col1")
          .text(
            `${Math.round(node1.colRow[1] + node1.colRow[0])}-${Math.round(
              node2.colRow[0] + node2.colRow[1]
            )}`
          );
      } else {
        addFastAtTable(
          node1.colRow[0],
          node1.colRow[1],
          node2.colRow[0],
          node2.colRow[1]
        );
      }
    }

    function createConstraint(node) {
      drawConstraint(node.XY[0], node.XY[1]);
      constraint = new Constraint(node.XY, node.colRow, node.coord);
      constraintsArray.push(constraint);
      if (constraintsArray.length === 1) {
        fillRow(reactTableBody.children().eq(0), [
          [1, Math.round(constraint.colRow[1] + constraint.colRow[0])],
        ]);
      } else {
        console.log(reactRowSample);
        reactTableBody.append(
          fillRow(reactRowSample.clone(true, true), [
            [1, Math.round(constraint.colRow[1] + constraint.colRow[0])],
          ])
        );
      }
    }

    function createLoad(node) {
      drawLoad(node.XY[0], node.XY[1]);
      load = new Load(node.XY, node.colRow, node.coord);
      loadsArray.push(load);
      if (loadsArray.length === 1) {
        fillRow(loadTableBody.children().eq(0), [
          [1, Math.round(load.colRow[1] + load.colRow[0])],
        ]);
      } else {
        console.log(loadRowSample);
        loadTableBody.append(
          fillRow(loadRowSample.clone(true, true), [
            [1, Math.round(load.colRow[1] + load.colRow[0])],
          ])
        );
      }
    }

    function deleteNode(i, j, nodeIndex) {
      const removedNode = nodesArray[nodeIndex];
      const adjacentPlates = findLineElementsAtNode(platesArray, removedNode);
      const adjacentFasteners = findLineElementsAtNode(fastArray, removedNode);
      const adjacentConstraint = findDotElemAtNode(
        constraintsArray,
        removedNode
      );
      const adjacentLoad = findDotElemAtNode(loadsArray, removedNode);

      if (
        adjacentPlates.length > 0 ||
        adjacentFasteners.length > 0 ||
        adjacentConstraint > -1 ||
        adjacentLoad > -1
      ) {
        let confirm = window.confirm(
          "The chosen node has an adjacent element(s). If you delete it, all adjacent elements will be removed too. Are you sure?"
        );
        if (confirm) {
          if (adjacentPlates.length > 0) {
            removeAdjacentElements(adjacentPlates, platesArray, plateTableBody);
          }
          if (adjacentFasteners.length > 0) {
            removeAdjacentElements(adjacentFasteners, fastArray, fastTableBody);
          }
          if (adjacentConstraint > -1) {
            deleteElement(constraintsArray, adjacentConstraint, reactTableBody);
          }
          if (adjacentLoad > -1) {
            deleteElement(loadsArray, adjacentLoad, loadTableBody);
          }
        } else {
          return;
        }
      }
      deleteElement(nodesArray, nodeIndex, nodeTableBody);
    }

    function clearRow(row, ...args) {
      // в args можно передать строки с номерами столбцов, которые очищать не нужно
      let flag;
      if (args.length === 0) {
        for (let item of row.children()) {
          $(item).text("");
        }
      } else {
        for (let item of row.children()) {
          flag = 0;
          for (let i = 0; i < args.length; i++) {
            if ($(item).hasClass(args[i])) {
              flag = 1;
            }
          }
          if (!flag) {
            $(item).text("");
          }
        }
      }
    }

    function findLineElementsAtNode(elemArray, node) {
      let foundedElemArray = [];
      elemArray.forEach((item, index) => {
        if (
          item.firstNode.colRow[0] + item.firstNode.colRow[1] ===
            node.colRow[0] + node.colRow[1] ||
          item.secondNode.colRow[0] + item.secondNode.colRow[1] ===
            node.colRow[0] + node.colRow[1]
        ) {
          foundedElemArray.push(index);
        }
      });
      return foundedElemArray;
    }

    function findLineElementBtwNodes(elemArray, node1, node2) {
      return elemArray.findIndex((item) => {
        return (
          item.firstNode.colRow[0] + item.firstNode.colRow[1] ===
            node1.colRow[0] + node1.colRow[1] &&
          item.secondNode.colRow[0] + item.secondNode.colRow[1] ===
            node2.colRow[0] + node2.colRow[1]
        );
      });
    }

    function removeAdjacentElements(adjacentElements, elemArray, elemTable) {
      let flag = 0;
      adjacentElements.forEach((index) => {
        if (flag === 1) {
          index--;
        }
        deleteElement(elemArray, index, elemTable);
        flag = 1;
      });
    }

    function findDotElemAtNode(elemArray, node) {
      return elemArray.findIndex(
        (item) =>
          item.colRow[0] + item.colRow[1] === node.colRow[0] + node.colRow[1]
      );
    }

    function deleteElement(elemArray, elemIndex, elemTable) {
      elemArray.splice(elemIndex, 1);
      if (elemArray.length === 0) {
        if (elemTable === fastTableBody) {
          clearRow(elemTable.children().eq(0), "col2");
        } else {
          clearRow(elemTable.children().eq(0));
        }
      } else {
        elemTable.children().eq(elemIndex).remove();
      }
      refreshModel();
    }

    function addFastenerProp(index, ...args) {
      args.forEach((item) => {
        fastArray[index][item[0]] = item[1];
      });
    }

    const resultsBlock = $(".results");
    const resultsLoadsTable = $(".table-result-loads tbody");
    const resultsDispBlock = $(".nodal-displacement");
    const calcTimeElement = $("#calc-time");

    const outputHandler = $(".output-mode");
    let calcResults = null;

    function addPartsProps() {
      Array.from(partTableBody.children()).forEach((item, index) => {
        partsArray[index].material = $(item).find(".col3").text();
        partsArray[index].E = $(item).find(".col4").text();
      });
    }
    
    function addNodesProps() {
      Array.from(nodeTableBody.children()).forEach((item, index) => {
        if (nodesArray[index]) {
          if ($(item).find(".node-thk").text()) {
            nodesArray[index].thk = +$(item).find(".node-thk").text();
          }
          if ($(item).find(".node-width-area").text()) {
            if (widthAreaSelect.val() === "width") {
              nodesArray[index].width = +$(item).find(".node-width-area").text();
              nodesArray[index].area = +$(item)
                .find(".node-width-area-calc")
                .text();
            } else {
              nodesArray[index].area = +$(item).find(".node-width-area").text();
              nodesArray[index].width = +$(item)
                .find(".node-width-area-calc")
                .text();
            }
          }
        }
      });
    }

    function addFastenersProps() {
      Array.from(fastTableBody.children()).forEach((item, index) => {
        if (fastArray[index]) {
          if ($(item).find(".col2 select").val()) {
            fastArray[index].type = $(item).find(".col2 select").val();
          }
          if ($(item).find(".col3").text()) {
            fastArray[index].partNumber = $(item).find(".col3").text();
          }
          if ($(item).find(".col4").text()) {
            fastArray[index].nomDia = +$(item).find(".col4").text();
          }
          if ($(item).find(".col5").text()) {
            fastArray[index].fastDia = +$(item).find(".col5").text();
          }
          if ($(item).find(".col6").text()) {
            fastArray[index].holeDia = +$(item).find(".col6").text();
          }
          if ($(item).find(".col7").text()) {
            fastArray[index].Ebb = +$(item).find(".col7").text();
          }
          if ($(item).find(".col8").text()) {
            fastArray[index].Gb = +$(item).find(".col8").text();
          }
          if ($(item).find(".col9").text()) {
            fastArray[index].spacing = +$(item).find(".col9").text();
          }
          if ($(item).find(".col10").text()) {
            fastArray[index].quantity = +$(item).find(".col10").text();
          }
        }
      });
    }

    $("#calc").on("click", (e) => {
      addPartsProps();
      addNodesProps();
      addFastenersProps();

      createJSONFromTable(partTableBody, partsArray);
      createJSONFromTable(nodeTableBody, nodesArray);
      createJSONFromTable(plateTableBody, platesArray);
      createJSONFromTable(fastTableBody, fastArray);
      createJSONFromTable(reactTableBody, constraintsArray);
      createJSONFromTable(loadTableBody, loadsArray);
      let obj = {
        parts: partsArray,
        nodes: nodesArray,
        plates: platesArray,
        fasteners: fastArray,
        constraints: constraintsArray,
        loads: loadsArray,
      };
      let JSONObj = JSON.stringify(obj);

      let result = convertData();
      console.log(result);

      $.ajax({
        type: "POST",
        url: "http://127.0.0.1:8000/joan/calc/",
        contentType: "application/json; charset=UTF-8",
        data: result,
        dataType: "json",
        success: function (data) {
          console.log(data);
          calcResults = data;
          refreshModel(chartOpacity);
          console.log(data);
          outputHandler.css("display", "block");
          showResults(data);
          outputFastenerMode[0].value = "load";
          outputPlateMode[0].value = "load";
          calcTimeElement.text(
            data.message
              ? "Расчет выполнен " +
                  new Date(data.message).toLocaleString("ru-RU")
              : "Возникла ошибка"
          );
          calcTimeElement.addClass(
            data.message ? "text-success" : "text-danger"
          );
          calcTimeElement.removeClass(
            data.message ? "text-danger" : "text-success"
          )
          $(".update-popup").css("display", "none");

          // outputNodeMode.prop('checked', false);
          // $('#output-node-loads').prop('checked', true);
          // outputFastenerMode.prop('checked', false);
          // $('#output-fastener-loads').prop('checked', true);
          // outputPlateMode.prop('checked', false);
          // $('#output-plate-loads').prop('checked', true);
          console.log(spacingArray);

          refreshModel(chartOpacity);
          showOutputNodeMode();
          showOutputPlateMode();
          showOutputFastenerMode();

          showPartNames();

          console.log(spacingArray);

        },
        error: function () {
          calcTimeElement.text("Возникла ошибка");
          calcTimeElement.addClass("text-danger");
        },
      });

      $("td[contenteditable]").on("input", (e) => {
        $(".update-popup").css("display", "block");
      });
    });

    function showPartNames() {
      partsArray.forEach(part => {
        let partObj = {part};
        const partPlates = platesArray.slice().filter(plate => plate.partName === part.name);
        if (partPlates.length > 0) {
          let currentPlate = partPlates[0];
          let currentNode = partPlates[0].firstNode;
          let minPartColCoord = partPlates[0].firstNode.colRow[0];
          
          partPlates.forEach(plate => {
            let currentMinPlateColCoord = Math.min(plate.firstNode.colRow[0], plate.secondNode.colRow[0]);
            if (minPartColCoord > currentMinPlateColCoord) {
              minPartColCoord = currentMinPlateColCoord;
              currentPlate = plate;
              currentNode = plate.firstNode.colRow[0] === currentMinPlateColCoord ? plate.firstNode : plate.secondNode;
            }
          });
          partObj.node = currentNode;
          partNames.push(partObj);
        }
      });
      drawPartNames();
    }
    
    function drawPartNames() {
      partNames.forEach(item => {
        const partSpan = document.createElement('span');
        $(partSpan).text(item.part.name);
        $(partSpan).addClass('part-name');
        canvasWrapper.append($(partSpan));
        $(partSpan).css({'left': (2 * item.node.XY[0] - gridPixelGap - parseFloat($(partSpan).css('width'))) / 2, 'top': item.node.XY[1] - parseFloat($(partSpan).css('height'))});
      });
    }

    function showResults(data) {
      const keysArr = Object.keys(data);
      keysArr.forEach((item) => {
        switch (item) {
          case "disp_vector": {
            //                        showNodalDisplacementVector(data[item], resultsDispBlock);
            break;
          }
          case "loads_and_stresses": {
            const sortedData = data[item]
              .slice()
              .sort(
                (item1, item2) =>
                  item1.node_id +
                  item1.coord_y -
                  (item2.node_id + item2.coord_y)
              );
            showLoadsSummary(sortedData);
            break;
          }
          case "reactions": {
            showReactions(data[item], 1, 1);
            break;
          }
          case "fasteners_loads_traffics": {
            showLoadTransfer(data[item], 1, 1);
            break;
          }
        }
      });
      showAppliedLoad(1, 1);
      showOutputNodeMode();
      resultsBlock.css("display", "block");
      addUnitsToTableHeaders(unitsSelect.val(), 'results');
      resultsBlock[0].scrollIntoView({ behavior: "smooth" });
    }

    function showLoadTransfer(data, count, total) {
      Object.keys(data).forEach((col) => {
        data[col].forEach((loadTransferItem) => {
          const plate1 = platesArray.find(
            (plate) =>
              transformPartNames(plate.partName) ===
                loadTransferItem.plate1_id &&
              (plate.firstNode.colRow[0] === +col ||
                plate.secondNode.colRow[0] === +col)
          );
          const plate2 = platesArray.find(
            (plate) =>
              transformPartNames(plate.partName) ===
                loadTransferItem.plate2_id &&
              (plate.firstNode.colRow[0] === +col ||
                plate.secondNode.colRow[0] === +col)
          );
          if (plate1 && plate2) {
            let currentNode =
              plate1.firstNode.colRow[0] === +col
                ? plate1.firstNode
                : plate1.secondNode;
            let transferNode =
              plate2.firstNode.colRow[0] === +col
                ? plate2.firstNode
                : plate2.secondNode;
            drawResults(
              loadTransferItem.load_traffic,
              currentNode,
              transferNode,
              "gray",
              count,
              total,
              "fastener_load"
            );
          }
        });
      });
    }

    function drawResults(
      value,
      currentNode,
      transferNode,
      color,
      count,
      total,
      type
    ) {

      let fontSize = 9;
      if (85 >= gridPixelGap && gridPixelGap > 72) {
        fontSize = 11;
      } else if (72 >= gridPixelGap && gridPixelGap > 66) {
        fontSize = 10;
      }

      ctx.fillStyle = color ? color : "black";
      ctx.lineWidth = 1;

      let decimalCount = 0;
      if (Math.abs(+value) >= 1) {
        value = Math.abs(+value).toFixed(1);
        let absValue = value;
        do {
          absValue /= 10;
          decimalCount++;
        } while (absValue >= 1);

        if (decimalCount > 4) {
          value = (+value).toExponential(2);
        } else if (decimalCount === 4) {
          value = Math.round(+value);
        } else if (decimalCount === 1) {
          value = (+value).toFixed(2);
        }
      } else {
        if (value < Math.pow(10, -3)) {
          value = (+value).toExponential(2);
        } else {
          value = Math.abs(+value).toFixed(3);
          decimalCount = 3;
        }
      }

      transferNode = transferNode ? transferNode : currentNode;

      const span = document.createElement("span");
      $(span).addClass("output-span");

      $(span).text(value);
      $(span).addClass(type);
      canvasWrapper.append(span);
      const leftRectVertCoord =
        (currentNode.XY[1] + transferNode.XY[1]) / 2 -
        ($(span).height() + (fontSize > 9 ? 2 : 0)) * (total / 2 - count + 1);
      const leftRectHorCoord =
        (currentNode.XY[0] + transferNode.XY[0]) / 2 - $(span).width() / 2;
      $(span).css({
        left: leftRectHorCoord,
        top: leftRectVertCoord,
        color: color ? color : "black",
        fontSize: fontSize
      });
    }

    function showReactions(data, count, total) {
      data.forEach((dataItem) => {
        const currentPlate = platesArray.find(
          (plate) =>
            transformPartNames(plate.partName) === dataItem[1] &&
            (plate.firstNode.colRow[0] === dataItem[0] ||
              plate.secondNode.colRow[0] === dataItem[0])
        );

        const partCoord = currentPlate.firstNode.colRow[1];

        const reactionRow = Array.from(reactTableBody.children()).find(item => {
          return $(item).find('.col1').text() === (dataItem[0] + partCoord).toString();
        });

        if (reactionRow) {
          $(reactionRow).find('.col2').text(Math.abs(dataItem[2].toFixed(1)));
        }

        if (currentPlate) {
          drawResults(
            Math.abs(dataItem[2].toFixed(1)),
            currentPlate.firstNode,
            currentPlate.secondNode,
            null,
            count,
            total,
            "reaction"
          );
        }
      });
    }

    function showAppliedLoad(count, total) {
      loadsArray.forEach((load) => {
        const currentPlate = platesArray.find((item) => {
          return (
            item.firstNode.colRow[0] + item.firstNode.colRow[1] ===
              load.colRow[0] + load.colRow[1] ||
            item.secondNode.colRow[0] + item.secondNode.colRow[1] ===
              load.colRow[0] + load.colRow[1]
          );
        });
        if (currentPlate) {
          let bypassNode = null;
          let currentNode = null;
          if (
            load.colRow[0] + load.colRow[1] ===
            currentPlate.firstNode.colRow[0] + currentPlate.firstNode.colRow[1]
          ) {
            currentNode = currentPlate.firstNode;
            bypassNode = currentPlate.secondNode;
          } else {
            currentNode = currentPlate.secondNode;
            bypassNode = currentPlate.firstNode;
          }
          if (currentNode && bypassNode) {
            drawResults(
              Math.abs(+load.value).toFixed(1),
              currentPlate.firstNode,
              currentPlate.secondNode,
              null,
              count,
              total,
              "external load"
            );
          }
        }
      });
    }

    function showLoadsSummary(sortedData) {
      const sortNodes = nodesArray
        .slice()
        .sort((node1, node2) => node1.colRow[1] - node2.colRow[1]);
      const minHorCoord = sortNodes[0].colRow[1];
      const maxHorCoord = sortNodes[nodesArray.length - 1].colRow[1];

      $(resultsLoadsTable).html("");
      const partsAmount = partsArray.length;

      let partName = null;
      let partNodesAmount = 1;

      sortedData.forEach((dataItem) => {
        const nodeRow = document.createElement("tr");

        if (partName !== transformPartNames(dataItem.plate_id)) {
          partName = transformPartNames(dataItem.plate_id);
          const plateName = document.createElement("td");
          $(plateName).text(partName);
          $(nodeRow).addClass("part");
          $(nodeRow).append(plateName);
          partNodesAmount = 1;
        } else {
          partNodesAmount += 1;
          $(resultsLoadsTable)
            .find(".part")
            .last()
            .children()
            .first()
            .attr("rowspan", partNodesAmount);
        }

        const plate = platesArray.find((plate) => {
          return (
            (plate.firstNode.colRow[0] === dataItem.node_id ||
              plate.secondNode.colRow[0] === dataItem.node_id) &&
            plate.partName === transformPartNames(dataItem.plate_id)
          );
        });

        const nodeCoord = Math.round(dataItem.coord_y + dataItem.node_id);
        const node = nodesArray.find(
          (item) => Math.round(item.colRow[0] + item.colRow[1]) === nodeCoord
        );
        const fastener = fastArray.find(
          (fastener) =>
            fastener.firstNode === node || fastener.secondNode === node
        );

        const nodeId = document.createElement("td");
        $(nodeId).text(nodeCoord);
        $(nodeRow).append(nodeId);

        const thickness = document.createElement("td");
        $(thickness).text(parseFloat(node.thk).toFixed(3));
        $(nodeRow).append(thickness);

        const area = document.createElement("td");
        $(area).text(parseFloat(node.area).toFixed(3));
        $(nodeRow).append(area);

        const fastenersAmount = document.createElement("td");
        $(fastenersAmount).text(1);
        $(nodeRow).append(fastenersAmount);

        const fastDia = document.createElement("td");
        $(fastDia).text(fastener.holeDia.toFixed(3));
        $(nodeRow).append(fastDia);

        const incomingLoad = document.createElement("td");
        $(incomingLoad).text(
          dataItem.applied_load
            ? roundToThreeSignificantDigits(dataItem.applied_load)
            : 0
        );
        $(nodeRow).append(incomingLoad);

        drawPlateLoad(dataItem, sortedData, 1, 1, "plate_load");

        const bypassLoad = document.createElement("td");
        $(bypassLoad).text(
          dataItem.bypass_load
            ? roundToThreeSignificantDigits(dataItem.bypass_load)
            : 0
        );
        $(nodeRow).append(bypassLoad);

        const loadTransfer = document.createElement("td");
        $(loadTransfer).text(
          dataItem.load_transfer
            ? roundToThreeSignificantDigits(dataItem.load_transfer)
            : 0
        );
        $(nodeRow).append(loadTransfer);

        const LTF = document.createElement("td");
        $(LTF).text(
          dataItem.bypass_over_applied_stress !== ""
            ? roundToThreeSignificantDigits(
                dataItem.load_transfer / dataItem.applied_load
              )
            : 0
        );
        $(nodeRow).append(LTF);

        const appliedStress = document.createElement("td");
        $(appliedStress).text(
          dataItem.applied_stress
            ? roundToThreeSignificantDigits(dataItem.applied_stress)
            : 0
        );
        $(nodeRow).append(appliedStress);

        const bypassStress = document.createElement("td");
        $(bypassStress).text(
          dataItem.bypass_stress
            ? roundToThreeSignificantDigits(dataItem.bypass_stress)
            : 0
        );
        $(nodeRow).append(bypassStress);

        const bearingStress = document.createElement("td");
        $(bearingStress).text(
          dataItem.bearing_stress
            ? roundToThreeSignificantDigits(dataItem.bearing_stress)
            : 0
        );
        $(nodeRow).append(bearingStress);

        const fBrOverfT = document.createElement("td");
        $(fBrOverfT).text(
          dataItem.bearing_over_applied_stresss
            ? roundToThreeSignificantDigits(
                dataItem.bearing_over_applied_stresss
              )
            : 0
        );
        $(nodeRow).append(fBrOverfT);

        const fBpOverfT = document.createElement("td");
        $(fBpOverfT).text(
          dataItem.bypass_over_applied_stress
            ? roundToThreeSignificantDigits(dataItem.bypass_over_applied_stress)
            : 0
        );
        $(nodeRow).append(fBpOverfT);

        const JES = document.createElement("td");
        $(JES).text(
          dataItem.jarfall_effective_stress
            ? roundToThreeSignificantDigits(dataItem.jarfall_effective_stress)
            : 0
        );
        $(nodeRow).append(JES);

        $(resultsLoadsTable).append(nodeRow);
      });
    }

    function roundToThreeSignificantDigits(number) {
      number = Math.abs(+number);
      let digits = 0;
      if (number >= Math.pow(10, 4) || number < Math.pow(10, -3)) {
        return number.toExponential(2);
      } else {
        for (let i = -2; i < 5; i++) {
          if (number < Math.pow(10, i)) {
            digits = 3 - i < 0 ? 0 : 3 - i;
            return i < 0
              ? number.toExponential(digits)
              : number.toFixed(digits);
          }
        }
      }
    }

    function drawPlateLoad(dataItem, sortedData, count, total, type) {
      const node = nodesArray.find(
        (item) =>
          item.colRow[0] + item.colRow[1] ===
          dataItem.coord_y + dataItem.node_id
      );
      let bypassNodeData = null;
      const bypassNextNodeData = sortedData.find(
        (item) =>
          item.coord_y === node.colRow[1] &&
          (item.node_id === node.colRow[0] + 1)
      );
      const bypassPrevNodeData = sortedData.find(
        (item) =>
          item.coord_y === node.colRow[1] &&
          (item.node_id === node.colRow[0] - 1)
      );
      if (bypassNextNodeData && bypassNextNodeData.bypass_load === dataItem.applied_load) { 
        bypassNodeData = bypassNextNodeData;
      } else if (bypassPrevNodeData && bypassPrevNodeData.bypass_load === dataItem.applied_load) {
          bypassNodeData = bypassPrevNodeData;
      } else if (bypassNextNodeData && bypassNextNodeData.applied_load === dataItem.applied_load) {
        bypassNodeData = bypassNextNodeData;
      } else if (bypassPrevNodeData && bypassPrevNodeData.applied_load === dataItem.applied_load) {
        bypassNodeData = bypassPrevNodeData;
      }
        
      let bypassNode = null;
      if (bypassNodeData) {
        bypassNode = nodesArray.find(
          (item) =>
            item.colRow[0] === bypassNodeData.node_id &&
            item.colRow[1] === bypassNodeData.coord_y
        );

        if (bypassNode) {
          drawResults(
            dataItem.applied_load.toFixed(1),
            node,
            bypassNode,
            null,
            count,
            total,
            type
          );
        }
      }
    }

    function findConnectParts(col) {
      const fastenersOnCurrentCol = fastArray.filter(
        (fastener) => fastener.firstNode.colRow[0] === col
      );
      let connectParts = [];
      fastenersOnCurrentCol.forEach((fastener) => {
        const firstNodePlate =
          platesArray.find((plate) => plate.firstNode === fastener.firstNode) ||
          platesArray.find((plate) => plate.secondNode === fastener.firstNode);
        const secondNodePlate =
          platesArray.find(
            (plate) => plate.firstNode === fastener.secondNode
          ) ||
          platesArray.find((plate) => plate.secondNode === fastener.secondNode);
        if (firstNodePlate && secondNodePlate) {
          const firstNodePart = firstNodePlate.partName.slice(-1);
          const secondNodePart = secondNodePlate.partName.slice(-1);

          if (!connectParts.includes(firstNodePart)) {
            connectParts.push(firstNodePart);
          }
          if (!connectParts.includes(secondNodePart)) {
            connectParts.push(secondNodePart);
          }
        }
      });
      connectParts.sort();
      return connectParts.length === 0 ? "-" : connectParts.join("-");
    }

    function drawLoadDirections(x, y, direction) {
      ctx.strokeStyle = "black";
      if (direction === "hor") {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, y + 0.5);
        ctx.lineTo(x + 15.5, y + 0.5);
        ctx.stroke();

        ctx.moveTo(x + 15.5, y + 0.5);
        ctx.lineTo(x + 10.5, y - 1.5);
        ctx.stroke();

        ctx.moveTo(x + 15.5, y + 0.5);
        ctx.lineTo(x + 10.5, y + 2.5);
        ctx.stroke();
      } else if (direction === "vert") {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, y + 0.5);
        ctx.lineTo(x + 0.5, y + 15.5);
        ctx.stroke();

        ctx.moveTo(x + 0.5, y + 15.5);
        ctx.lineTo(x + 2.5, y + 10.5);
        ctx.stroke();

        ctx.moveTo(x + 0.5, y + 15.5);
        ctx.lineTo(x - 1.5, y + 10.5);
        ctx.stroke();
      }
    }

    function transformPartNames(partName) {
      const firstPlateCharCode = 'a'.charCodeAt(0);
      console.log(firstPlateCharCode);
      if (typeof partName === "string") {
        let plateId = partName.charCodeAt(partName.length - 1);
        return plateId - firstPlateCharCode + 1;
      } else if (typeof partName === "number") {
        return 'Part ' + String.fromCharCode((partName - 1 + firstPlateCharCode));
      }
    }

    function showNodalDisplacementVector(data, resultsDispElement) {
      resultsDispElement.html("");
      const numDispArray = data.map((item) =>
        item ? (+item).toExponential(3) : 0
      );
      const tableNodalDisp = $(document.createElement("table"));
      tableNodalDisp.addClass("table table-bordered table-sm");
      const theadNodalDisp = $(document.createElement("thead"));
      const tbodyNodalDisp = $(document.createElement("tbody"));
      theadNodalDisp.append("<tr></tr>");
      tbodyNodalDisp.append("<tr></tr>");
      tableNodalDisp.append(theadNodalDisp);
      tableNodalDisp.append(tbodyNodalDisp);
      resultsDispElement.append(tableNodalDisp);

      for (let i = 0; i < numDispArray.length; i++) {
        const tdNodalDisp = $(document.createElement("td"));
        tdNodalDisp.text(numDispArray[i]);
        tbodyNodalDisp.find("tr").append(tdNodalDisp);
      }
    }

    function convertData() {
      let id = null;
      let coordX = null;
      let plate = null;
      let plateId = null;
      let colsArray = [];
      let testNode = {};
      let testNodes = [];
      let method = null;

      method = methodSelect.val();

      const sortedNodes = nodesArray
        .slice()
        .sort((node1, node2) => node1.coord - node2.coord);

      sortedNodes.forEach((node) => {
        if (coordX !== node.coord) {
          coordX = node.coord;
          if ("id" in testNode) {
            testNodes.push(testNode);
          }
          testNode = {};
          testNode.id = node.colRow[0];
          testNode.coord_x = node.coord;
          testNode.plates_id = [];
          testNode.plates_th = [];
          testNode.plates_area = [];

          let fast = fastArray.find(
            (fastener) => fastener.firstNode.coord === node.coord
          );
          testNode.fastener_type = fast ? fast.type : "";
          testNode.fastener_id = fast ? fast.partNumber + fast.nomDia : "";
          testNode.Ebb = fast ? fast.Ebb : "";
          testNode.Gb = fast ? fast.Gb : "";
          testNode.fast_dia = fast ? fast.fastDia : "";
          testNode.hole_dia = fast ? fast.holeDia : "";
          testNode.spacing = fast ? fast.spacing : "";
          testNode.quantity = fast ? fast.quantity : "";
        }
        testNode.plates_th.push(node.thk);
        testNode.plates_area.push(node.area);
        let plate = platesArray.find(
          (plate) =>
            plate.firstNode.colRow[0] + plate.firstNode.colRow[1] ===
              node.colRow[0] + node.colRow[1] ||
            plate.secondNode.colRow[0] + plate.secondNode.colRow[1] ===
              node.colRow[0] + node.colRow[1]
        );
        if (plate) {
          testNode.plates_id.push(transformPartNames(plate.partName));
        }
      });
      testNodes.push(testNode);

      let testPlates = {};
      let sortedPlates = platesArray
        .slice()
        .sort(
          (plate1, plate2) =>
            transformPartNames(plate1.partName) -
            transformPartNames(plate2.partName)
        );
      let minColCoord = null;
      let maxColCoord = null;
      for (let plateIndex in platesArray) {
        let partObj = {};
        if (
          Object.keys(testPlates).some(
            (item) =>
              +item === transformPartNames(platesArray[plateIndex].partName)
          )
        ) {
          const currentMaxCoord = Math.max(
            platesArray[plateIndex].firstNode.colRow[0],
            platesArray[plateIndex].secondNode.colRow[0]
          );
          const currentMinCoord = Math.min(
            platesArray[plateIndex].firstNode.colRow[0],
            platesArray[plateIndex].secondNode.colRow[0]
          );
          if (minColCoord && maxColCoord) {
            if (minColCoord > currentMinCoord) {
              minColCoord = currentMinCoord;
              testPlates[Object.keys(testPlates).length].firstNodeCoord =
                minColCoord;
            }
            if (maxColCoord < currentMaxCoord) {
              maxColCoord = currentMaxCoord;
              testPlates[Object.keys(testPlates).length].secondNodeCoord =
                maxColCoord;
            }
          }
          continue;
        } else {
          minColCoord = Math.min(
            platesArray[plateIndex].firstNode.colRow[0],
            platesArray[plateIndex].secondNode.colRow[0]
          );
          maxColCoord = Math.max(
            platesArray[plateIndex].firstNode.colRow[0],
            platesArray[plateIndex].secondNode.colRow[0]
          );

          const part = partsArray.find(
            (part) => part.name === platesArray[+plateIndex].partName
          );
          const partMaterial = part.material.trim();
          const partHorCoord = platesArray[+plateIndex].firstNode.colRow[1];
          const partModule = +part.E;

          partObj.material = partMaterial;
          partObj.coord = partHorCoord;
          partObj.E = partModule;
          partObj.firstNodeCoord = minColCoord;
          partObj.secondNodeCoord = maxColCoord;

          testPlates[Object.keys(testPlates).length + 1] = partObj;

          //                    testPlates[Object.keys(testPlates).length + 1] = [partMaterial, partHorCoord, partModule];
        }
      }

      let testBoundaryConditions = {};
      testBoundaryConditions.nodes_id = [];
      testBoundaryConditions.plates_id = [];
      testBoundaryConditions.constraints = [];
      let col = null;
      let j = -1;
      for (let i = 0; i < constraintsArray.length; i++) {
        if (constraintsArray[i]) {
          const node = nodesArray.find(
            (node) =>
              node.colRow[0] + node.colRow[1] ===
              constraintsArray[i].colRow[0] + constraintsArray[i].colRow[1]
          );
          const plateIndex = findLineElementsAtNode(platesArray, node);
          if (col !== constraintsArray[i].colRow[0]) {
            col = constraintsArray[i].colRow[0];
            testBoundaryConditions.nodes_id.push(col);
            if (node && plateIndex > -1) {
              testBoundaryConditions.plates_id.push([
                transformPartNames(platesArray[plateIndex].partName),
              ]);
            }
            testBoundaryConditions.constraints.push([0]);
            j++;
          } else {
            testBoundaryConditions.plates_id[j].push(
              transformPartNames(platesArray[plateIndex].partName)
            );
            testBoundaryConditions.constraints[j].push(0);
          }
        }
      }

      let testLoads = {};
      testLoads.nodes_id = [];
      testLoads.plates_id = [];
      testLoads.loads = [];
      col = null;
      j = -1;
      for (let i = 0; i < loadsArray.length; i++) {
        if (loadsArray[i]) {
          const node = nodesArray.find(
            (node) =>
              node.colRow[0] + node.colRow[1] ===
              loadsArray[i].colRow[0] + loadsArray[i].colRow[1]
          );
          const plateIndex = findLineElementsAtNode(platesArray, node);
          if (col !== loadsArray[i].colRow[0]) {
            col = loadsArray[i].colRow[0];
            testLoads.nodes_id.push(col);
            if (node && plateIndex > -1) {
              testLoads.plates_id.push([
                transformPartNames(platesArray[plateIndex].partName),
              ]);
            }
            testLoads.loads.push([+loadsArray[i].value]);
            j++;
          } else {
            testLoads.plates_id[j].push(
              transformPartNames(platesArray[plateIndex].partName)
            );
            testLoads.loads[j].push(+loadsArray[i].value);
          }
        }
      }

      let testJointInfo = {};
      testJointInfo.method = method;
      testJointInfo.nodes = testNodes;
      testJointInfo.plates = testPlates;
      testJointInfo.boundary_conditions = testBoundaryConditions;
      testJointInfo.loads = testLoads;

      return JSON.stringify(testJointInfo);
    }

    $('#file-select').change((e) => {
      onFilesSelect(e);
    })
    
    function onFilesSelect(e) {
      // получаем объект FileList
      var files = e.target.files;
    
      // Перебираем все файлы в FileList'е
      for (var i = 0; i < files.length; i++) {
        let file = files[i];
        var fileReader = new FileReader();
        fileReader.onload = function(e) {
          // сохраняем текст файла в переменную
          var textContent = e.target.result;
          console.log(textContent);
          readDataFromFile(textContent);
        }
    
        // читаем файл как текст
        fileReader.readAsText(file);
      }
    }

    const fileNameInput = $('#file-name');
    const saveModelLink = $('#save-model-link');

    fileNameInput.on('input', ((e) => {
      if ($(e.target).val()) {
        saveModelLink.removeClass('disabled');
      } else {
        saveModelLink.addClass('disabled');
      }
    }));

    saveModelLink.click(function() {
      let data = createInputDataForSave();
      // let blob = new Blob([data], {type: "text/plain; charset=utf-8"});
      // let fileName = prompt('Введите имя файла:');
      // if (fileName) {
      //   saveAs(blob, fileName);
      // }

      this.href += `, ${encodeURIComponent(data)}`;
      const fileName = fileNameInput.val();
      if (fileName) {
        this.download = `${fileNameInput.val()}.txt`;
      }
    })

    function createInputDataForSave() {
      addPartsProps();
      addNodesProps();
      addFastenersProps();
      
      return JSON.stringify({ 
        modelCols: modelCols, 
        modelRows: modelRows, 
        units: unitsSelect.val(), 
        partsArray, 
        widthAreaSelect: widthAreaSelect.val(),
        nodesArray, 
        platesArray, 
        fastArray, 
        constraintsArray, 
        loadsArray, 
        spacingArray 
      });
    }

    function readDataFromFile(textContent) {
      let inputData = JSON.parse(textContent);
      partsArray = inputData.partsArray;
      nodesArray = inputData.nodesArray;
      platesArray = inputData.platesArray;
      fastArray = inputData.fastArray;
      constraintsArray = inputData.constraintsArray;
      loadsArray = inputData.loadsArray;
      modelCols = inputData.modelCols;
      colsAmount.val(modelCols);
      modelRows = inputData.modelRows;
      rowsAmount.val(modelRows);
      unitsSelect.val(inputData.units);
      widthAreaSelect.val(inputData.widthAreaSelect);
      widthAreaSelect.change();
      spacingArray = inputData.spacingArray;
      console.log(modelCols, modelRows, unitsSelect.val(), partsArray, nodesArray, platesArray, fastArray, constraintsArray, loadsArray);
      createModelfromInputFile();
    }

    function createModelfromInputFile() {
      drawGrid(modelCols, modelRows);
      refreshModel();

      partAmountSelect.val(partsArray.length);

      partsArray.forEach(part => {
        const existPartRow = Array.from(partTableBody.children()).find(partRow => $(partRow).find(".col1").text() === part.name);
        if (existPartRow) {
          $(existPartRow).find(".col3").text(part.material);
          $(existPartRow).find(".col4").text(part.E);
        } else {
          const newPartRow = partRowSample.clone(true, true);
          newPartRow.find(".col1").text(part.name);
          $(newPartRow).find(".col3").text(part.material);
          $(newPartRow).find(".col4").text(part.E);
          partTableBody.append(newPartRow);
        }
      });

      let widthCol = widthAreaSelect.val() === 'width' ? 4 : 5;
      
      nodesArray.forEach((node, index) => {
        let nodeData = [
          [1, Math.round(node.colRow[1] + node.colRow[0])],
          [2, node.coord],
          [3, node.thk],
          [4, widthCol === 4 ? node.width : node.area],
          [5, widthCol === 5 ? node.width : node.area]
        ];
        fillTablesFromInputData(index, nodeTableBody, nodeData);
      });

      platesArray.forEach((plate, index) => {
        let plateE = partsArray.find(part => part.name === plate.partName).E;
        let plateData = [
          [1, `${Math.round(plate.firstNode.colRow[1] + plate.firstNode.colRow[0])}-${Math.round(
            plate.secondNode.colRow[0] + plate.secondNode.colRow[1]
          )}`],
          [2, plate.partName],
          [3, plateE],
        ];
        fillTablesFromInputData(index, plateTableBody, plateData);
      });

      fastArray.forEach((fastener, index) => {
        let fastData = [
          [1, `${Math.round(fastener.firstNode.colRow[1] + fastener.firstNode.colRow[0])}-${Math.round(
            fastener.secondNode.colRow[0] + fastener.secondNode.colRow[1]
          )}`],
          [3, fastener.partNumber],
          [4, fastener.nomDia],
          [5, fastener.fastDia],
          [6, fastener.holeDia],
          [7, fastener.Ebb],
          [8, fastener.Gb],
          [9, fastener.spacing],
          [10, fastener.quantity]
        ];

        fillTablesFromInputData(index, fastTableBody, fastData);
        $(fastTableBody.children()[fastTableBody.children().length - 1]).find('.col2 select').val(fastener.type);
      });

      constraintsArray.forEach((constraint, index) => {
        let constraintData = [
          [1, Math.round(constraint.colRow[1] + constraint.colRow[0])],
        ];

        fillTablesFromInputData(index, reactTableBody, constraintData);
      });

      loadsArray.forEach((load, index) => {
        let loadData = [
          [1, Math.round(load.colRow[1] + load.colRow[0])],
          [2, load.value],
        ];

        fillTablesFromInputData(index, loadTableBody, loadData);
      });
    }

    function fillTablesFromInputData(index, tableBody, data) {
      if (index === 0) {
        fillRow(tableBody.children().eq(0), data);
      } else {
        tableBody.append(
          fillRow(tableBody.children().eq(0).clone(true, true), data)
        );
      }
    }
  });
})();
