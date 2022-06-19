class PopUp {
    constructor(
        title,
        data,
        type = "table",
        actions = [{ classes: ["secondary"], link: "close", title: "Done" }],
        opts = {}
    ) {
        this.parent = $("body")
        this.title = title
        this.data = data
        this.type = type
        this.actions = actions
        this.opts = opts

        this.container = this.create()
    }

    create() {

        console.log("creating new popup")

        var container = $("<div/>", { "class": "pop-up-container" })
        var popUp = $("<div/>", { "class": "pop-up" })
        var popUpHeader = $("<div/>", { "class": "pop-up-header flex row space" })
            .append($("<h7/>").text(this.title))

        var popUpContent = $("<div/>", { "class": "pop-up-content" })

        if (this.type == "table") {
            var table = $("<div/>", { "class": "table fixed alternate" })
            this.data.forEach(function (v, k) {
                var row = $("<div/>", { "class": "tr" })
                if (k == 0) row.addClass("th")

                v.forEach(function (e, i) {
                    var cell = $("<div/>", { "class": "td" })
                    if (e.type == "text") {
                        cell.text(e.content)
                        if (e.classes) cell.addClass(e.classes.join(" "))

                    } else if (e.type == "button") {
                        var button = $("<a/>", { "class": "button" })
                        button.text(e.content)
                        if (e.classes) button.addClass(e.classes.join(" "))
                        cell.append(button)

                    } else if (e.type == "input") {
                        var c = $("<div/>", { "class": "input-label no-padding" })
                        var input = $("<input>", { type: "text", name: e.name, placeholder: e.placeholder })
                        if (e.value) input.val(e.value)
                        if (e.data_value) input.data("value", e.data_value)
                        if (e.autocomplete) input.addClass("no-expand").autocomplete(e.autocomplete)
                        if (e.classes) cell.addClass(e.classes.join(" "))
                        c.append(input)
                        cell.append(c)

                    } else if (e.type == "html") {
                        cell.append(e.content)
                    }

                    if (typeof this.opts !== "undefined"
                        && this.opts.colspans
                        && this.opts.colspans.length >= i) {
                        cell.addClass("colspan__" + this.opts.colspans[i])
                    }
                    row.append(cell)
                }.bind(this))
                table.append(row)
            }.bind(this))
            popUpContent.append(table)

        } else if (this.type == "slide-select") {
            var slides = $("<div/>", { "class": "slide-select flex row space relative", id: this.opts.name })
            var links = $("<div/>", { "class": "slide-links" })
            this.data.forEach(function (v, k) {
                slides.append(
                    $("<div/>", { "class": "slide-item flex-item grow flex row center" })
                        .data("value", v.name)
                        .text(v.value))

                links.append(v.link)
            }.bind(this))
            slides.append($("<div/>", { "class": "slide-background" }))

            popUpContent.append(slides).append(links)
        }

        popUp.append(popUpHeader)
        popUp.append(popUpContent)

        if (this.actions) {
            console.log(this.actions)
            var popUpActions = $("<div/>", { "class": "pop-up-actions flex row space mobile-column" })
            this.actions.forEach(function (v, k) {
                var button = $("<a/>", { "class": "button" })
                button.text(v.title)
                if (k > 0) button.addClass("flex-item flex-margin-small")
                if (v.classes) button.addClass(v.classes.join(" "))
                if (v.link) {
                    if (v.link == "close") {
                        button.on("click", function () {
                            this.destroy()
                        }.bind(this))
                    } else if (v.link == "add-row") {
                        button.on("click", function () {
                            if (this.opts && this.opts.prototype) {
                                table.append(this.opts.prototype)
                            }
                        }.bind(this))
                    } else if (v.link == "save") {
                        button.on("click", function () {
                            container.trigger("save")
                            this.destroy()
                        }.bind(this))
                    } else {
                        button.attr("href", v.link)
                    }
                }
                popUpActions.append(button)
            }.bind(this))
            popUp.append(popUpActions)
        }

        if ("help" in this.opts) {
            console.log(this.opts.help)
            popUpHeader.append(
                $("<div/>", { "class": "profile-help-container" })
                    .append($("<h3/>").text("?"))
                    .append($("<div/>", { "class": "profile-help-content" }).text(this.opts.help)))
        }

        container.append(popUp)
        this.parent.append(container)

        container.hide()
        container.fadeIn("fast")

        $(document).on("click", function (e) {
            if ($(e.target).hasClass("pop-up-container")) this.destroy()
        }.bind(this))

        if (this.type == "slide-select") initSlideSelect()

        return container
    }

    destroy() {
        this.container.fadeOut("fast")
        setTimeout(() => { this.container.remove() }, 1000)
    }
}

function createPopUp() {
    return new PopUp(...arguments)
}