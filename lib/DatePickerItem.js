
/**
 * @module Date组件
 */
import React, { Component } from 'react';
import * as TimeUtil from './time.js';
import { shallowEqual } from './pureRender.js';
import { addPrefixCss, formatCss } from './prefix.js';

const DATE_LENGTH = 10;                              // 日期的个数
const MIDDLE_INDEX = Math.floor(DATE_LENGTH / 2);     // 日期数组中间值的索引

const MAX_ITEM_SPIN_COUNT = 7;
const FIXED_SPIN_ANIMATION_TIME = 400;

const isUndefined = val => typeof val === 'undefined';
const isArray = val => Object.prototype.toString.apply(val)  === '[object Array]';
const isFunction = val => Object.prototype.toString.apply(val)  === '[object Function]';

/**
 * 根据格式获取时间滑动的类别
 * @param  {String} format 格式
 * @return {string}        类别名称
 */
const getTimeType = format => {
    const typeMap = {
        Y: 'Year',
        M: 'Month',
        D: 'Date',
        h: 'Hour',
        m: 'Minute',
        s: 'Second',
    };

    for (const key in typeMap) {
        if (typeMap.hasOwnProperty(key)) {
            if (~format.indexOf(key)) {
                return typeMap[key]
            }
        }
    }

    throw new Error('时间格式必须包含 Y, M, D, h, m 或 s字母');
}

type Props = {
    value: Object,
    min: Object,
    max: Object,
    format: string | Array<*>,
    step: number,
    onSelect: Function,
    itemHeight: number,
}

type State = {
    translateY: number,
    marginTop: number,
}

/**
 * Class Date组件类
 * @extends Component
 */
class DatePickerItem extends Component<void, Props, State> {
    constructor(props) {
        super(props);
        this.animating = false;                 // 判断是否在transition过渡动画之中
        this.touchY = 0;                        // 保存touchstart的pageY
        this.translateY = 0;                    // 容器偏移的距离
        this.lastEventTime = Date.now();
        this.lastTouchY = 0;
        this.velocity = 0;
        this.currentIndex = MIDDLE_INDEX;       // 滑动中当前日期的索引
        this.moveDateCount = 0;                 // 一次滑动移动了多少个时间
        this.itemHeight = props.itemHeight;
        this.middleY = - this.itemHeight * MIDDLE_INDEX;

        this.state = {
            translateY: this.middleY,
            marginTop: (this.currentIndex - MIDDLE_INDEX) * this.itemHeight,
        };

        // 设置时间选择器单元的类别
        if (isArray(props.format)) {
            this.typeName = getTimeType(props.format[0]);
            this.format = props.format[0];
            if (isFunction(props.format[1])) {
                this.formatTransform = props.format[1];
            }
        }

        else {
            this.format = props.format;
            this.typeName = getTimeType(props.format);
        }

        this.renderDatepickerItem = this.renderDatepickerItem.bind(this);
        this.handleContentTouch = this.handleContentTouch.bind(this);
        this.handleContentMouseDown = this.handleContentMouseDown.bind(this);
        this.handleContentMouseMove = this.handleContentMouseMove.bind(this);
        this.handleContentMouseUp = this.handleContentMouseUp.bind(this);
    }

    componentWillMount() {
        this._iniDates(this.props.value);
    }

    componentDidMount() {
        const viewport = this.viewport;
        viewport.addEventListener('touchstart', this.handleContentTouch, false);
        viewport.addEventListener('touchmove', this.handleContentTouch, false);
        viewport.addEventListener('touchend', this.handleContentTouch, false);
        viewport.addEventListener('mousedown', this.handleContentMouseDown, false);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.value.getTime() === this.props.value.getTime()) {
            return;
        }
        this._iniDates(nextProps.value);
        this.currentIndex = MIDDLE_INDEX;
        this.setState({
            translateY: this.middleY,
            marginTop: (this.currentIndex - MIDDLE_INDEX) * this.itemHeight,
        });
    }

    /**
     * Optimization component, Prevents unnecessary rendering
     * Only value or state change should re-rendering
     *
     * @param  {Object} nextProps next props
     * @param  {Object} nextState next state
     * @return {Boolean}          Whether re-rendering
     */
    shouldComponentUpdate(nextProps, nextState) {
        return nextProps.value.getTime() !== this.props.value.getTime() ||
            !shallowEqual(nextState, this.state);
    }

    componentWillUnmount() {
        const viewport = this.viewport;
        viewport.removeEventListener('touchstart', this.handleContentTouch, false);
        viewport.removeEventListener('touchmove', this.handleContentTouch, false);
        viewport.removeEventListener('touchend', this.handleContentTouch, false);
        viewport.removeEventListener('mousedown', this.handleContentMouseDown, false);
    }

    _iniDates(date) {
        const typeName = this.typeName;
        const dates = Array(...Array(DATE_LENGTH))
            .map((value, index) =>
                TimeUtil[`next${typeName}`](date, (index - MIDDLE_INDEX) * this.props.step));
        this.setState({ dates });
    }

    _updateDates(difference) {
        const typeName = this.typeName;
        const { dates } = this.state;
        const { step } = this.props;
        if (difference > 0) {
            const shiftedItems = dates.slice(0, difference).map(function(date){
                return TimeUtil[`next${typeName}`](date, step);
            });
            this.currentIndex += difference;
            this.setState({
                dates: dates.slice(difference).concat(shiftedItems),
                marginTop: (this.currentIndex - MIDDLE_INDEX) * this.itemHeight,
            });
        } else if (difference < 0) {
            const shiftedItems = dates.slice(dates.length + difference, dates.length).map(function(date){
                return TimeUtil[`next${typeName}`](date, step);
            });;
            this.currentIndex += difference;
            this.setState({
                dates: shiftedItems.concat(dates.slice(0, dates.length + difference)),
                marginTop: (this.currentIndex - MIDDLE_INDEX) * this.itemHeight,
            });
        }
    }

    _checkIsUpdateDates(direction, translateY) {
        return direction === 1 ?
            this.currentIndex * this.itemHeight + this.itemHeight / 2 < -translateY :
            this.currentIndex * this.itemHeight - this.itemHeight / 2 > -translateY;
    }

    /**
     * 清除对象的transition样式
     * @param  {Dom}     obj     指定的对象
     * @return {undefined}
     */
    _clearTransition(obj) {
        addPrefixCss(obj, { transition: '' });
    }

    /**
     * 滑动到下一日期
     * @param  {number} direction 滑动方向
     * @return {undefined}
     */
    _moveToNext(direction) {
        const date = this.state.dates[MIDDLE_INDEX];
        const { max, min } = this.props;
        if (direction === -1 && date.getTime() < min.getTime() && this.moveDateCount) {
            this._updateDates(1);
        } else if (direction === 1 && date.getTime() > max.getTime() && this.moveDateCount) {
            this._updateDates(-1);
        }

        this._moveTo(this.refs.scroll, this.currentIndex, direction);
    }

    /**
     * 添加滑动动画
     * @param  {DOM} obj   DOM对象
     * @param  {number} angle 角度
     * @return {undefined}
     */
    _moveTo(obj, currentIndex, direction) {
        this.animating = true;

        const accelerationRate = -(this.velocity / FIXED_SPIN_ANIMATION_TIME); // units per ms for decelleration

        let unitsToTravel = 0;
        for (var i = 0; i < FIXED_SPIN_ANIMATION_TIME; i++) {
            unitsToTravel += this.velocity;
            this.velocity += accelerationRate;
        }

        const absoluteUnitsToTravel = Math.abs(unitsToTravel);

        const additionalIndexesToTravel = [
            -MAX_ITEM_SPIN_COUNT,
            Math.floor(absoluteUnitsToTravel / this.itemHeight) * direction,
            MAX_ITEM_SPIN_COUNT
        ].sort(function(a, b){ return a - b; })[1];

        const virtualCurrentIndex = additionalIndexesToTravel + currentIndex;

        addPrefixCss(obj, { transition: `transform ${FIXED_SPIN_ANIMATION_TIME}ms ease-out` });

        this.setState({
            translateY: -virtualCurrentIndex * this.itemHeight,
        });

        // NOTE: There is no transitionend, setTimeout is used instead.
        setTimeout(() => {
            this._updateItemsAndMargin(additionalIndexesToTravel);
            this.animating = false;
            this.props.onSelect(this.state.dates[MIDDLE_INDEX]);
            this._clearTransition(this.refs.scroll);
        }, FIXED_SPIN_ANIMATION_TIME);
    }

    handleStart(event) {
        this.touchY =
            (!isUndefined(event.targetTouches) &&
             !isUndefined(event.targetTouches[0])) ?
            event.targetTouches[0].pageY :
            event.pageY;

        this.translateY = this.state.translateY;
        this.moveDateCount = 0;
    }


    handleMove(event) {
        const touchY =
            (!isUndefined(event.targetTouches) &&
             !isUndefined(event.targetTouches[0])) ?
            event.targetTouches[0].pageY :
            event.pageY;

        const dir = touchY - this.touchY;
        const translateY = this.translateY + dir;
        const direction = dir > 0 ? -1 : 1;

        const diff = this.lastTouchY - touchY;
        const now = Date.now();
        const timeDiff = now - this.lastEventTime;
        this.velocity = diff / timeDiff;

        this.lastEventTime = Date.now();
        this.lastTouchY = touchY;

        // 日期最小值，最大值限制
        const date = this.state.dates[MIDDLE_INDEX];
        const { max, min } = this.props;
        if (date.getTime() < min.getTime() ||
            date.getTime() > max.getTime()) {
            return;
        }

        // 检测是否更新日期列表
        if (this._checkIsUpdateDates(direction, translateY)) {
            this.moveDateCount = direction > 0 ? this.moveDateCount + 1 : this.moveDateCount - 1;
            this._updateDates(direction);
        }

        this.setState({ translateY });
    }

    handleEnd(event) {
        const touchY = event.pageY || event.changedTouches[0].pageY;
        const dir = touchY - this.touchY;
        const direction = dir > 0 ? -1 : 1;
        this._moveToNext(direction);
    }

    /**
     * 滑动日期选择器触屏事件
     * @param  {Object} event 事件对象
     * @return {undefined}
     */
    handleContentTouch(event) {
        event.preventDefault();
        if (this.animating) return;
        if (event.type === 'touchstart') {
            this.handleStart(event);
        } else if (event.type === 'touchmove') {
            this.handleMove(event);
        } else if (event.type === 'touchend') {
            this.handleEnd(event);
        }
    }

    /**
     * 滑动日期选择器鼠标事件
     * @param  {Object} event 事件对象
     * @return {undefined}
     */
    handleContentMouseDown(event) {
        if (this.animating) return;
        this.handleStart(event);
        document.addEventListener('mousemove', this.handleContentMouseMove);
        document.addEventListener('mouseup', this.handleContentMouseUp);
    }

    handleContentMouseMove(event) {
        if (this.animating) return;
        this.handleMove(event);
    }

    handleContentMouseUp(event) {
        if (this.animating) return;
        this.handleEnd(event);
        document.removeEventListener('mousemove', this.handleContentMouseMove);
        document.removeEventListener('mouseup', this.handleContentMouseUp);
    }

    /**
     * 渲染一个日期DOM对象
     * @param  {Object} date date数据
     * @return {Object}      JSX对象
     */
    renderDatepickerItem(date, index) {
        const className =
            (date < this.props.min || date > this.props.max) ?
            'disabled' : '';

        let formatDate = TimeUtil.convertDate(date, this.format);
        if (this.formatTransform) {
            formatDate = this.formatTransform(formatDate);
        }

        return (
            <li
                key={index}
                className={className}
                style={{
                    height: this.itemHeight,
                    lineHeight: `${this.itemHeight}px`,
                }}
            >
                {formatDate}
            </li>
        );
    }

    render() {
        const scrollStyle = formatCss({
            transform: `translateY(${this.state.translateY}px)`,
            marginTop: this.state.marginTop,
        });

        return (
            <div className="datepicker-col-1">
                <div
                    ref={viewport => this.viewport = viewport} // eslint-disable-line
                    className="datepicker-viewport"
                    style={{ height: this.itemHeight * 5 }}
                >
                    <div
                        className="datepicker-wheel"
                        style={{
                            height: this.itemHeight,
                            marginTop: -(this.itemHeight / 2)
                        }}
                    >
                        <ul
                            ref="scroll"
                            className="datepicker-scroll"
                            style={scrollStyle}>
                            {this.state.dates.map(this.renderDatepickerItem)}
                        </ul>
                    </div>
                </div>
            </div>
        );
    }
}

export default DatePickerItem;
