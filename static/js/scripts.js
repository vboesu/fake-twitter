$(function () {

    // lazy load fonts
    $.ajax({
        url: "/static/css/fonts.css",
        beforeSend: x => {
            x.overrideMimeType("application/octet-stream")
        },
        success: () => {
            $("<link/>", {
                rel: "stylesheet",
                href: "/static/css/fonts.css"
            }).appendTo("head")
        }
    })

    // lazy load images
    $("img.lazy-load-image").each(function () {
        $(this).on("load", function () {
            $(this).removeAttr("data-src")
        })
        $(this).attr("src", $(this).data("src"))
    })

    // empty contenteditable divs on focusout
    $(document).on("focusout", "div[contenteditable]", function () {
        var element = $(this)
        if (!element.text().trim().length) element.empty()
    })

    // div contenteditable to input automatically
    $(document).on("input change keyup", "div[contenteditable]", function () {
        var id = "input[name=" + $(this).attr("id") + "]"
        var v = $(this).text()
        if (!$(id).length) {
            $(this).parent().append(
                $("<input/>", { type: "hidden", name: $(this).attr("id"), value: v }))
        } else {
            $(id).val(v)
        }

        $(id).trigger("input")
    })

    // contenteditable div filters

    $(document).on("focus", "div[contenteditable][data-limit]", function (e) {
        $(this).trigger("input")
    })

    $(document).on("focusout", "div[contenteditable][data-limit]", function (e) {
        setTimeout(() => { $(this).siblings(".text-limit-bar").css("width", 0) }, 1000)
    })

    $(document).on("input", "div[contenteditable][data-limit]", function (e) {
        var type = $(this).data("limit").split(":")[0]
        var limit = +$(this).data("limit").split(":")[1]
        var text = $(this).text()
        var current = 0

        if (type == "char") {
            current = text.length
            text = text.substring(0, limit)
        } else if (type == "word") {
            current = text.split(/[\W]+/).length
            var re = new RegExp("([\\w]+[\\W]?){0," + limit + "}")
            text = text.match(re)[0]
        }

        var fraction = current / limit

        if (fraction > 0.9) {
            $(this).siblings(".text-limit-bar").addClass("red")
        } else {
            $(this).siblings(".text-limit-bar").removeClass("red")
        }

        if (fraction >= 1.0) {
            e.preventDefault()
            $(this).text(text)
            cursorToEnd($(this))
        }

        $(this).siblings(".text-limit-bar").css("width", String(Math.min(fraction, 1.0) * 100) + "%")
        $(this).siblings(".text-limit-bar").show()
    })

    $("div[contenteditable][data-limit]").each(function () {
        $(this).parent().append($("<div/>", { "class": "text-limit-bar" }))
    })

    // enter to click
    $(document).on("keypress", function (e) {
        var code = (e.keyCode ? e.keyCode : e.which)
        console.log(e)
        if (e.target == document.body || ($(e.target).is("input") && !e.shiftKey)) {
            if (code == 13) $(".enter-to-click").trigger("click")
        }
    })

    // button animations
    $(document).on("mousedown touchstart", ".button", function () { $(this).addClass("click") })
    $(document).on("mouseup touchend", () => { $(".button").removeClass("click") })

    // slide select
    $(document).on("click", ".slide-item", function () {
        var id = $(this).closest(".slide-select").attr("id")
        $(".slide-select#" + id).find(".slide-item.active").removeClass("active")
        $(this).addClass("active")

        slideSelect[id].selected = $(this).index()
        setSlideBackground(id)
    })

    initSlideSelect()

    // prototypes
    $(".prototype [data-protolength]").each(function () {
        var length = parseInt($(this).data("protolength"))
        length /= 2
        $(this).html("&nbsp; ".repeat(Math.round(length)))
    })

    // mobile collapse
    $("main .content-header").click(function () {
        // toggle collapse
        var this_ = $(this).closest("main")
        $("main").addClass("collapsed")
        this_.removeClass("collapsed")
    })
})

function fillDataKey(obj, e, root = null) {
    $.each(e, function (k, v) {
        if (typeof v === 'object') {
            // recurse
            fillDataKey(obj, v, k)
        } else {
            // save as data in object
            var key = root ? `${root}.${k}` : k
            obj.data(key, v)

            var element = obj.find(`[data-key='${key}']`)
            if (element.is("img")) {
                element.prop("src", v)
            } else if (element.is("date")) {
                element.data("date", v)
                registerDynamicDate(element)
            } else {
                element.text(v)
            }

            if (key == "deleted" && v) obj.addClass("deleted")
        }
    })
}

function fillPrototype(data, prototype, container) {
    $(`${prototype}.prototype`).addClass("done")
    $(`${prototype}:not(.prototype)`).remove()

    data.forEach(function (e, i) {
        var obj = $(`${prototype}.prototype.done`).clone()
        fillDataKey(obj, e)

        obj.removeClass("prototype")
        obj.appendTo(container)
    })
}

// slide select functions
var slideSelect = {}

function initSlideSelect() {
    $(".slide-select").each(function () {
        var id = $(this).attr("id")
        var index = $(this).find(".slide-item.active").index() == -1 ? 0 : $(this).find(".slide-item.active").index()

        slideSelect[id] = {
            n: $(this).find(".slide-item").length,
            selected: index
        }

        if (!$(this).find("input").length)
            $(this).append($("<input/>", { type: "hidden", name: id }))

        $(this).find(".slide-item").eq(index).addClass("active")

    })

    setSlideBackground()
}

function updateSlideBackground(id) {
    $(".slide-select#" + id).find(".slide-background").css("width", 100 / slideSelect[id].n + "%")
    $(".slide-select#" + id).find(".slide-background").css("left", slideSelect[id].selected / slideSelect[id].n * 100 + "%")
    $(".slide-select#" + id).find("input").val($(".slide-select#" + id).find(".active").data("value"))
    $(".slide-select#" + id).trigger("change")

    $(".slide-link").hide()
    $(".slide-link[data-link='" + $(".slide-select#" + id).find(".active").data("value") + "'").show()
}

function setSlideBackground(id = null) {
    if (!id) {
        for (const id in slideSelect) {
            updateSlideBackground(id)
        }
    } else {
        updateSlideBackground(id)
    }
}

// contenteditable div functions
function cursorToEnd(e) {
    var range, selection
    if (e instanceof jQuery) e = e.get(0)

    if (document.createRange) {
        range = document.createRange()
        range.selectNodeContents(e)
        range.collapse(false)
        selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
    } else if (document.selection) {
        range = document.body.createTextRange()
        range.moveToElementText(e)
        range.collapse(false)
        range.select()
    }
}

// dynamic dates
function registerDynamicDate(e) {
    e.text(dynamicDate(e.data("date")))

    setInterval(() => {
        e.text(dynamicDate(e.data("date")))
    }, 5000)
}

function dynamicDate(date) {
    let dt = new Date(date)
    let now = new Date()

    var diff = now - dt
    var label = ""

    $.each([[1000, "s", 60], [60, "m", 60], [60, "h", 24], [24, "d", Infinity]], (k, v) => {
        diff /= v[0]
        if (diff < v[2]) return !(label = `${Math.round(diff)}${v[1]}`) // return false to break loop
    })

    return label
}

// encode base64
function base64(string) {
    return btoa(encodeURIComponent(string))
}

function args(obj) {
    var string = "?"
    $.each(obj, function (k, v) {
        string += `${k}=${encodeURIComponent(v)}&`
    })

    return string.replace(/([&?]$)/gm, "")
}

// advanced file upload
$(function () {
    $(document).on("input change", ".file-upload input[type=file]", function () {
        this.files = validateFiles(this.files)
    })
})

function testAdvancedUpload() {
    var div = document.createElement("div")
    return ("ondrag" in div)
}

function setAdvancedUpload() {
    $(".file-upload").addClass("advanced")

    var droppedFiles = false

    $(".file-upload").on("drag dragstart dragend dragover dragenter dragleave drop", function (e) {
        e.preventDefault()
        e.stopPropagation()
    })
        .on("dragover dragenter", function () {
            $(".file-upload").addClass("is-dragover")
        })
        .on("dragleave dragend drop", function () {
            $(".file-upload").removeClass("is-dragover")
        })
        .on("drop", function (e) {
            droppedFiles = e.originalEvent.dataTransfer.files
            $(".file-upload").find("input[type=file]").get(0).files = validateFiles(droppedFiles)
        })
}

function validateFiles(files) {

    $(".file-upload").addClass("is-error")
    setTimeout(function () { $(".file-upload").removeClass("is-error") }, 2000)
    $(".file-upload__info").text("")

    console.log(files)

    if (files && files.length) {
        if (files.length > 1) {
            $(".file-upload__error span").text("You can only upload one file")
            return null
        }
        else if (files[0].size > 2097152) {
            $(".file-upload__error span").text("File must be smaller than 2MB")
            return null
        }
        else if (!["image/jpeg", "image/jpg", "image/png"].includes(files[0].type)) {
            $(".file-upload__error span").text("Filetype " + files[0].type + " not supported")
            return null
        }

        $(".file-upload__info").text("File OK")
        $(".file-upload").removeClass("is-error")

        setTimeout(() => {
            $(".file-upload__info").text("")
        }, 2000)

        if ($(".file-upload").data("preview")) {
            $("." + $(".file-upload").data("preview")).attr("src", window.URL.createObjectURL(files[0]))
        }

        return files
    }

}